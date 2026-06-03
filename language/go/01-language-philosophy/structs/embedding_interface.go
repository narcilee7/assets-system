package structs

import "io"

type ReadWriter struct {
	io.Reader
	io.Writer
}

var _ io.ReadWriter = (*ReadWriter)(nil)
