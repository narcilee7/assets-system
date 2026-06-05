/*
 * epoll-bench: Benchmark select vs poll vs epoll
 *
 * Usage:
 *   ./epoll-bench <mode> <nfds> <active> <iterations>
 *
 *   mode: select | poll | epoll
 *   nfds: total number of file descriptors (pipes)
 *   active: how many fds have data ready
 *   iterations: how many rounds
 *
 * Example:
 *   ./epoll-bench select 1000 100 1000
 *   ./epoll-bench poll 1000 100 1000
 *   ./epoll-bench epoll 1000 100 1000
 *
 * Build: make epoll-bench
 */

#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/time.h>
#include <sys/select.h>
#include <sys/epoll.h>
#include <poll.h>
#include <errno.h>

static double now_us(void)
{
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return tv.tv_sec * 1e6 + tv.tv_usec;
}

/* Create nfds pairs of pipes, write 1 byte to 'active' of them */
static int setup_pipes(int nfds, int active, int **fds_out)
{
    int *fds = malloc(nfds * 2 * sizeof(int));
    if (!fds) {
        perror("malloc");
        return -1;
    }

    for (int i = 0; i < nfds; i++) {
        if (pipe(fds + i * 2) < 0) {
            perror("pipe");
            free(fds);
            return -1;
        }
    }

    /* Write 1 byte to 'active' pipes */
    for (int i = 0; i < active && i < nfds; i++) {
        char c = 'x';
        if (write(fds[i * 2 + 1], &c, 1) != 1) {
            perror("write");
        }
    }

    *fds_out = fds;
    return 0;
}

static void cleanup_pipes(int nfds, int *fds)
{
    for (int i = 0; i < nfds; i++) {
        close(fds[i * 2]);
        close(fds[i * 2 + 1]);
    }
    free(fds);
}

/* Benchmark select() */
static double bench_select(int nfds, int active, int iterations, int *fds)
{
    fd_set rfds;
    int maxfd = 0;
    for (int i = 0; i < nfds; i++) {
        if (fds[i * 2] > maxfd) maxfd = fds[i * 2];
    }

    double start = now_us();
    for (int iter = 0; iter < iterations; iter++) {
        FD_ZERO(&rfds);
        for (int i = 0; i < nfds; i++) {
            FD_SET(fds[i * 2], &rfds);
        }

        struct timeval tv = {0, 0};
        int ret = select(maxfd + 1, &rfds, NULL, NULL, &tv);
        if (ret < 0) {
            perror("select");
            break;
        }
    }
    double end = now_us();
    return (end - start) / iterations;
}

/* Benchmark poll() */
static double bench_poll(int nfds, int active, int iterations, int *fds)
{
    struct pollfd *pfds = malloc(nfds * sizeof(struct pollfd));
    for (int i = 0; i < nfds; i++) {
        pfds[i].fd = fds[i * 2];
        pfds[i].events = POLLIN;
    }

    double start = now_us();
    for (int iter = 0; iter < iterations; iter++) {
        for (int i = 0; i < nfds; i++) {
            pfds[i].revents = 0;
        }
        int ret = poll(pfds, nfds, 0);
        if (ret < 0) {
            perror("poll");
            break;
        }
    }
    double end = now_us();

    free(pfds);
    return (end - start) / iterations;
}

/* Benchmark epoll_wait() */
static double bench_epoll(int nfds, int active, int iterations, int *fds)
{
    int epfd = epoll_create1(EPOLL_CLOEXEC);
    if (epfd < 0) {
        perror("epoll_create1");
        return -1;
    }

    struct epoll_event ev;
    for (int i = 0; i < nfds; i++) {
        ev.events = EPOLLIN;
        ev.data.u32 = i;
        if (epoll_ctl(epfd, EPOLL_CTL_ADD, fds[i * 2], &ev) < 0) {
            perror("epoll_ctl ADD");
            close(epfd);
            return -1;
        }
    }

    struct epoll_event *events = malloc(nfds * sizeof(struct epoll_event));

    double start = now_us();
    for (int iter = 0; iter < iterations; iter++) {
        int ret = epoll_wait(epfd, events, nfds, 0);
        if (ret < 0) {
            perror("epoll_wait");
            break;
        }
    }
    double end = now_us();

    free(events);
    close(epfd);
    return (end - start) / iterations;
}

int main(int argc, char **argv)
{
    if (argc != 5) {
        fprintf(stderr, "Usage: %s <select|poll|epoll> <nfds> <active> <iterations>\n", argv[0]);
        return 1;
    }

    const char *mode = argv[1];
    int nfds = atoi(argv[2]);
    int active = atoi(argv[3]);
    int iterations = atoi(argv[4]);

    if (nfds <= 0 || active < 0 || iterations <= 0) {
        fprintf(stderr, "Invalid parameters\n");
        return 1;
    }

    printf("Mode: %s | Total FDs: %d | Active: %d | Iterations: %d\n",
           mode, nfds, active, iterations);

    int *fds = NULL;
    if (setup_pipes(nfds, active, &fds) < 0) {
        return 1;
    }

    double avg_us = 0;
    if (strcmp(mode, "select") == 0) {
        if (nfds > FD_SETSIZE) {
            fprintf(stderr, "Warning: nfds > FD_SETSIZE (%d), select will fail\n", FD_SETSIZE);
        }
        avg_us = bench_select(nfds, active, iterations, fds);
    } else if (strcmp(mode, "poll") == 0) {
        avg_us = bench_poll(nfds, active, iterations, fds);
    } else if (strcmp(mode, "epoll") == 0) {
        avg_us = bench_epoll(nfds, active, iterations, fds);
    } else {
        fprintf(stderr, "Unknown mode: %s\n", mode);
        cleanup_pipes(nfds, fds);
        return 1;
    }

    printf("Average latency per call: %.3f us\n", avg_us);

    cleanup_pipes(nfds, fds);
    return 0;
}
