package linkedlist

import "fmt"

type Node struct {
	Value int
	Next *Node
}

type LinkedList struct {
	Head *Node
	Size int
}

func (l *LinkedList) Append(value int) {
	node := &Node{Value: value}

	if l.Head == nil {
		l.Head = node
		l.Size++
		return
	}
	cur := l.Head
	for cur.Next != nil {
		cur = cur.Next
	}
	cur.Next = node
	l.Size++
}

func (l *LinkedList) Prepend(value int) {
	node := &Node{
		Value: value,
		Next: l.Head,
	}
	l.Head = node
	l.Size++
}

func (l *LinkedList) Find(value int) *Node {
	cur := l.Head

	for cur != nil {
		if cur.Value == value {
			return cur
		}
		cur = cur.Next
	}

	return nil
}

func (l *LinkedList) Delete(value int) bool {
	if l.Head == nil {
		return false
	}

	if l.Head.Value == value {
		l.Head = l.Head.Next
		l.Size--
		return true
	}

	prev := l.Head
	cur := l.Head.Next

	for cur != nil {
		if cur.Value == value {
			prev.Next = cur.Next
			l.Size--
			return true
		}
		prev = cur
		cur = cur.Next
	}
	return false
}

func (l *LinkedList) Print() {
	cur := l.Head

	for cur != nil {
		fmt.Println("%d ->", cur.Value)
		cur = cur.Next
	}

	fmt.Println(("nil"))
}