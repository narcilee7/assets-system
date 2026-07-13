package iinterface

type Node[T any] struct {
	Value T
	Prev *Node[T]
	Next *Node[T]
}

type LinkedList[T any] struct {
	Head *Node[T]
	Tail *Node[T]
	Size int
}


func (l *LinkedList[T]) PushFront(v T) *Node[T] {
	node := &Node[T]{Value: v}

	if l.Head == nil {
		l.Head = node 
		l.Tail = node
		l.Size++
		return node
	}

	node.Next = l.Head
	l.Head.Prev = node
	l.Head = node

	l.Size += 1

	return node
}

func (l *LinkedList[T]) PushBack(v T) *Node[T] {
	node := &Node[T]{Value: v}

	if l.Tail == nil {
		l.Tail = node
		l.Head = node
		l.Size++
		return node
	}

	node.Prev = l.Tail
	l.Tail.Next = node
	l.Tail = node

	l.Size++

	return node
}

func (l *LinkedList[T]) Remove(node *Node[T]) {
	if node == nil {
		return
	}

	if node.Prev != nil {
		node.Prev.Next = node.Next
	} else {
		l.Head = node.Next
	}

	if node.Next == nil {
		l.Tail = nil
	} else {
		node.Next.Prev = node.Prev
	}

	node.Next = nil
	node.Prev = nil

	l.Size -= 1
}

func (l *LinkedList[T]) MoveToFront(node *Node[T]) {
	if node == nil || node == l.Head {
		return
	}

	// 断开
	if node.Prev != nil {
		node.Prev.Next = node.Next
	}
	if node.Next != nil {
		node.Next.Prev = node.Prev
	} else {
		l.Tail = node.Prev
	}

	// 投茶法
	node.Prev = nil
	node.Next = l.Head

	l.Head.Prev = node
	l.Head = node
}

func (l *LinkedList[T]) PopBack() *Node[T] {
	if l.Tail == nil {
		return nil
	}

	node := l.Tail

	l.Remove(node)

	return node
}
