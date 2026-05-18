(function () {
    const iframe = document.createElement("iframe");

    iframe.src = "https://encegen-ai-chatbot.vercel.app/";

    iframe.style.position = "fixed";
    iframe.style.bottom = "20px";
    iframe.style.right = "20px";
    iframe.style.width = "380px";
    iframe.style.height = "700px";
    iframe.style.border = "none";
    iframe.style.borderRadius = "20px";
    iframe.style.zIndex = "999999";
    iframe.style.background = "white";
    iframe.style.boxShadow = "0 10px 40px rgba(0,0,0,0.3)";

    document.body.appendChild(iframe);
})();