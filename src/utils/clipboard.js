// =============================================
// src/utils/clipboard.js
// =============================================

// Copia texto al portapapeles. Devuelve true si funcionó.
export async function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Algunos webviews (Instagram/WhatsApp) exponen la API pero la rechazan
        }
    }

    // Fallback con textarea oculto + execCommand
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, 99999);

    let ok;
    try {
        ok = document.execCommand('copy');
    } catch {
        ok = false;
    }
    document.body.removeChild(textarea);
    return ok;
}
