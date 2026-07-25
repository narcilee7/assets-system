package iinterface


type Stack[T any] interface {
	Push(T)
	Pop()  (T, bool)
	Peek() (T, bool)
	Size() int
	IsEmpty() bool
}
