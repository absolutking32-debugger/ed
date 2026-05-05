// ========================================
// TRACK.JS - Script de tracking para qualquer pagina
// Cole no <head>: <script src="track.js"></script>
// ========================================

(function() {
    var TRACK_URL = 'https://conversa-luizinha.blog/api/checkout-event';
    var SESSION_KEY = 'track_session_id';

    var sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) {
        sessionId = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
        localStorage.setItem(SESSION_KEY, sessionId);
    }

    var payload = JSON.stringify({
        event: 'page_viewed',
        session_id: sessionId,
        timestamp: new Date().toISOString(),
        meta: {
            user_agent: navigator.userAgent,
            referrer: document.referrer,
            page_url: window.location.href
        },
        data: {
            title: document.title
        }
    });

    if (navigator.sendBeacon) {
        navigator.sendBeacon(TRACK_URL, new Blob([payload], { type: 'application/json' }));
    } else {
        fetch(TRACK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
        }).catch(function() {});
    }
})();
