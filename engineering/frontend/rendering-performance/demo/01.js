function bad(element) {
  for (let i = 0; i < 100; i++) {
    const height = element.offsetHeight;
    element.style.height = `${height}px`;
  }
  // 200次reflow
}

function good(elements) {
  const heights = [];
  for (let i = 0; i < 100; i++) {
    const height = elements[i].offsetHeight;
    heights.push(height);
  }
  for (let i = 0; i < 100; i++) {
    elements[i].style.height = `${heights[i]}px`;
  }
  // 2次reflow
}
