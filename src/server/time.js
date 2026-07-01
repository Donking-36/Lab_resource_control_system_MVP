function nowText() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

module.exports = {
  nowText,
};
