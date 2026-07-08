const initAuth = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const ticket = urlParams.get("ticket");

  if (ticket) {
    const auth = await fetch("/auth/exchange", { ticket });
    localStorage.setItem("access_token", auth.token);
    history.replaceState({}, "", window.location.pathname);
  }

  const token = localStorage.getItem("access_token");
  if (!token || isTokenExpired(token)) {
    // 未登录，调用容器登录
    const result = await JSBridge.invoke("auth", "login");
    localStorage.setItem("access_token", result.token);
  }
};
