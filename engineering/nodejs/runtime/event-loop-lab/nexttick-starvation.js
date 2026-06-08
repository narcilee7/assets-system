let count = 0;
function busyNextTick() {
  if (count++ < 5) {
    process.nextTick(busyNextTick);
    console.log('nextTick', count);
  }
}
busyNextTick();
setTimeout(() => console.log('setTimeout should not starve'), 0);
