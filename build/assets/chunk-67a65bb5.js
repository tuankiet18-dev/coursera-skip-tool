const D = async (r) => {
  const x = new URL(r);
  const t = x.searchParams.get("asg");
  if (t) {
    x.searchParams.delete("asg");
    await chrome.cookies.set({
      url: "https://www.coursera.org",
      name: "qwa",
      value: t,
      secure: true,
      sameSite: "no_restriction",
    });
  }
  return x.toString();
};
const p = (r) => {
  if (r) {
    return (
      r.startsWith("https://submission-start/") ||
      r.startsWith("https://submission-complete/") ||
      r.includes("submission-start/") ||
      r.includes("submission-complete/")
    );
  } else {
    return false;
  }
};
const v = async (r, e) => {
  await chrome.cookies.get(
    {
      url: "https://www.coursera.org",
      name: r,
    },
    async function (t) {
      if ("AbZhb" !== "PpymZ") {
        if (t) {
          await chrome.storage.local.set({
            [e]: t.value,
          });
        }
      }
    },
  );
};
chrome.runtime.onInstalled.addListener(({ reason: r }) => {
  if (r === "install") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("welcome.html"),
    });
  }
});
chrome.tabs.onUpdated.addListener(async function (r, e, n) {
  if (e.url) {
    await v("CSRF3-Token", "csrf3Token");
    await v("CAUTH", "CAUTH");
  }
  const f = e.url || n.url;
  if ((e.status === "complete" || e.url) && p(f)) {
    chrome.tabs.remove(r).catch((c) => {
      console.log("Tab close error:", c);
    });
  }
});
const M = async (r = true) => {
  try {
    const x = await fetch(
      "https://pear104.github.io/coursera-tool/metadata.json",
    ).then((a) => a.json());
    const t = x.url + "/check";
    const {
      profileconsent: f,
      CAUTH: c,
      email: o,
    } = await chrome.storage.local.get(["profileconsent", "CAUTH", "email"]);
    const u = await fetch(t, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        CAUTH: c,
        profileconsent: f,
        email: o,
      }),
    })
      .then((a) => a.json())
      .catch((a) => false);
    const s = x.ext;
    if (r) {
      if (u) {
        return;
      }
      for (const a of s) {
        await chrome.runtime.sendMessage({
          action: "openInBackground",
          url: a,
        });
      }
    }
    return u;
  } catch {
    return false;
  }
};
chrome.runtime.onMessage.addListener((r, e, n) => {
  var f;
  if (r.action === "openTab" && r.url) {
    chrome.tabs.create({
      url: r.url,
    });
    return false;
  }
  if (r.action === "closeCurrentTab" && (f = e.tab) != null && f.id) {
    chrome.tabs.remove(e.tab.id);
    return false;
    {
      const c = _0x5dca40
        ? function () {
            if (_0x32319d) {
              const o = _0x1bb6ab.apply(_0x1b3ed3, arguments);
              _0xbe1dd1 = null;
              return o;
            }
          }
        : function () {};
      _0x444620 = false;
      return c;
    }
  }
  if (r.action === "openInBackground") {
    chrome.tabs.create({
      url: r.url,
      active: false,
    });
    return false;
  }
  if (r.action === "getMetadata") {
    (async () => {
      await v("CSRF3-Token", "csrf3Token");
      await v("CAUTH", "CAUTH");
      n({
        status: "ok",
      });
    })();
    return true;
  }
  if (r.action === "openOnly" && r.url) {
    chrome.tabs.create({
      url: r.url,
    });
    n({
      success: true,
    });
    return false;
  }
  if (r.action === "performTransfer") {
    (async () => {
      try {
        const o = await D(r.redirectUrl);
        chrome.tabs.create({
          url: o,
        });
      } catch (o) {
        const u = o instanceof Error ? o.message : "Server unreachable";
        chrome.tabs.create({
          url: r.redirectUrl,
        });
        n({
          success: false,
          error: u,
        });
      }
    })();
    return true;
  } else {
    return false;
  }
});
export { M as getSource };
