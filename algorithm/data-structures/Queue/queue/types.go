package queue

type Queue [T any] []T

func (q *Queue[T]) Eneuqe(v T) {
	*q = append(*q, v)
}

func (q *Queue[T]) Dequeue() (T, bool) {
	v := (*q)[0]
	*q = (*q)[1:]
	return v, true
}
