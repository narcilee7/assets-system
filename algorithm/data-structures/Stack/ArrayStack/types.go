package arraystack

type ArrayStack[T any] struct {
	data []T
}

func (s *ArrayStack[T]) Push(v T) {
	s.data = append(s.data, v)
}

func (s *ArrayStack[T]) Pop() (T, bool) {
	var zero T

	if len(s.data) == 0 {
		return zero, false
	}

	last := len(s.data) - 1
	value := s.data[last]

	var empty T
	s.data[last] = empty

	s.data = s.data[:last]

	return value, true
}

func (s *ArrayStack[T]) Peek() (T, bool) {
	var zero T

	if len(s.data) == 0 {
		return zero, false
	}

	return s.data[len(s.data) - 1], true
}

func (s *ArrayStack[T]) Size() int {
	return len(s.data)
}

func (s *ArrayStack[T]) IsEmpty() bool  {
	return  len(s.data)==0
}

