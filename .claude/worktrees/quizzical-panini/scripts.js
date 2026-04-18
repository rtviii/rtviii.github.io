document.addEventListener("DOMContentLoaded", function () {
  // 1. Image Zoom
  const images = document.querySelectorAll(".zoomable");
  images.forEach((img) => {
    img.addEventListener("click", function () {
      this.classList.toggle("zoomed");
    });
  });

  // 2. Rich Previews
  if (typeof tippy === "function") {
    const links = document.querySelectorAll(".listing-section a");

    links.forEach((link) => {
      const url = link.href;

      tippy(link, {
        content: "Loading preview...",
        allowHTML: true,
        theme: "light-border",
        placement: "right",
        interactive: true,
        maxWidth: 450, // Larger width for "rich" look
        delay: [400, 0],
        onShow(instance) {
          // --- YouTube Previews ---
          if (url.includes("youtube.com") || url.includes("youtu.be")) {
            const urlObj = new URL(url);
            let videoId = "";

            if (url.includes("youtu.be")) {
              videoId = urlObj.pathname.slice(1);
            } else {
              videoId = urlObj.searchParams.get("v");
            }

            if (videoId) {
              // Fetch title via oEmbed
              fetch(
                `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
              )
                .then((res) => res.json())
                .then((data) => {
                  // Check for maxres (high quality) thumbnail, fallback to mq (medium)
                  const thumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

                  instance.setContent(`
                <div style="width: 400px; font-family: 'IBM Plex Sans', sans-serif;">
                    <img src="${thumbUrl}" onerror="this.src='https://img.youtube.com/vi/${videoId}/mqdefault.jpg'" style="width:100%; border-radius:4px; border: 1px solid #eee;">
                    <div style="padding: 10px;">
                        <strong style="display:block; font-size:15px; line-height:1.3; color:#1a1a1a;">${data.title}</strong>
                        <span style="font-size:12px; color:#666; margin-top:4px; display:block;">${data.author_name} • YouTube</span>
                    </div>
                </div>
            `);
                })
                .catch(() => {
                  instance.setContent(
                    `<div style="padding:10px;">Could not load preview for ${videoId}</div>`
                  );
                });
            }
          } else {
            // For Blogs: We simulate a "Rich Card"
            // Note: True metadata scraping usually requires a backend, but we can style the link beautifully
            const domain = new URL(url).hostname.replace("www.", "");
            instance.setContent(`
              <div style="width: 350px; padding: 12px; font-family: 'IBM Plex Sans', sans-serif;">
                <div style="text-transform: uppercase; font-size: 10px; letter-spacing: 1px; color: #007bff; margin-bottom: 4px;">${domain}</div>
                <div style="font-size: 14px; font-weight: 600; line-height: 1.4; color: #222; margin-bottom: 8px;">
                  ${link.innerText || "External Article"}
                </div>
                <div style="font-size: 12px; color: #666; word-break: break-all;">${url}</div>
              </div>
            `);
          }
        },
      });
    });
  }
});
