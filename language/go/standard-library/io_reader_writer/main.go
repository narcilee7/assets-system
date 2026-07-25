package main

// import (
// 	"crypto/sha256"
// 	"encoding/hex"
// 	"hash"
// 	"io"
// )

// type countReader struct {
// 	r io.Reader
// 	n int64
// }

// func (c *countReader) Read(p []byte) (int, error) {
// 	n, err := c.r.Read(p)
// 	c.n += int64(n)
// 	return n, err
// }

// type hashWriter struct {
// 	w io.Writer
// 	h hash.Hash
// }

// func newHashWriter(w io.Writer) *hashWriter {
// 	return  &hashWriter{w: w, h: sha256.New()}
// }

// func (h *hashWriter) Write(p []byte) (int, error) {
// 	h.h.Write(p)
// 	return h.w.Write(p)
// }

// func (h *hashWriter) Sum() string {
// 	return hex.EncodeToString(h.h.Sum(nil))
// }