package ringqueue

type RingQueue[T any] struct {
	buf []T

	head int
	tail int

	size int
}
