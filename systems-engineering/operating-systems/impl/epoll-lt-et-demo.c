/*
 * epoll-lt-et-demo: Demonstrate Level-Triggered vs Edge-Triggered behavior
 *
 * Usage:
 *   Terminal 1: ./epoll-lt-et-demo <lt|et>
 *   Terminal 2: echo "hello" > /tmp/epoll-demo-fifo
 *
 *   With LT: each epoll_wait returns as long as data is unread
 *   With ET: epoll_wait returns only once, you must drain the fd
 *
 * Build: make epoll-lt-et-demo
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/epoll.h>
#include <errno.h>

#define FIFO_PATH "/tmp/epoll-demo-fifo"
#define BUF_SIZE 4  /* Small buffer to force partial reads */

int main(int argc, char **argv)
{
    if (argc != 2) {
        fprintf(stderr, "Usage: %s <lt|et>\n", argv[0]);
        return 1;
    }

    int use_et = (strcmp(argv[1], "et") == 0);
    if (!use_et && strcmp(argv[1], "lt") != 0) {
        fprintf(stderr, "Mode must be 'lt' or 'et'\n");
        return 1;
    }

    /* Create FIFO */
    unlink(FIFO_PATH);
    if (mkfifo(FIFO_PATH, 0666) < 0) {
        perror("mkfifo");
        return 1;
    }

    printf("Mode: %s\n", use_et ? "Edge-Triggered (ET)" : "Level-Triggered (LT)");
    printf("FIFO: %s\n", FIFO_PATH);
    printf("Please run in another terminal:\n");
    printf("  echo -n 'abcdefgh' > %s\n\n", FIFO_PATH);

    int fd = open(FIFO_PATH, O_RDONLY | O_NONBLOCK);
    if (fd < 0) {
        perror("open");
        unlink(FIFO_PATH);
        return 1;
    }

    int epfd = epoll_create1(EPOLL_CLOEXEC);
    if (epfd < 0) {
        perror("epoll_create1");
        return 1;
    }

    struct epoll_event ev;
    ev.events = EPOLLIN;
    if (use_et) {
        ev.events |= EPOLLET;
    }
    ev.data.fd = fd;
    if (epoll_ctl(epfd, EPOLL_CTL_ADD, fd, &ev) < 0) {
        perror("epoll_ctl");
        return 1;
    }

    struct epoll_event events[1];
    char buf[BUF_SIZE];
    int round = 0;

    while (1) {
        printf("--- Round %d: calling epoll_wait... ---\n", ++round);
        int nfds = epoll_wait(epfd, events, 1, -1);
        if (nfds < 0) {
            perror("epoll_wait");
            break;
        }

        printf("epoll_wait returned %d fd(s) ready\n", nfds);

        if (nfds == 0) {
            printf("Timeout (should not happen with -1)\n");
            continue;
        }

        /* Try to read */
        ssize_t n = read(fd, buf, sizeof(buf) - 1);
        if (n > 0) {
            buf[n] = '\0';
            printf("Read %zd bytes: '%s'\n", n, buf);
        } else if (n == 0) {
            printf("FIFO closed by writer\n");
            break;
        } else if (errno == EAGAIN || errno == EWOULDBLOCK) {
            printf("Read returned EAGAIN (no more data right now)\n");
            if (use_et) {
                /* In ET mode, we drained the fd, need new data to trigger again */
                printf("[ET] Waiting for NEW data to arrive...\n");
            }
        } else {
            perror("read");
            break;
        }

        /*
         * In LT mode: if data remains, the next epoll_wait will immediately
         * return again because the fd is still in readable state.
         *
         * In ET mode: epoll_wait will block until NEW data arrives, even if
         * old data is still in the buffer (but we read BUF_SIZE each time,
         * so after several rounds we drain it).
         */

        if (round >= 5) {
            printf("\nStopping after 5 rounds to avoid infinite loop in LT mode.\n");
            printf("Observe the difference:\n");
            printf("  LT: epoll_wait keeps returning while unread data exists\n");
            printf("  ET: epoll_wait only returns when state changes (new data)\n");
            break;
        }
    }

    close(epfd);
    close(fd);
    unlink(FIFO_PATH);
    return 0;
}
