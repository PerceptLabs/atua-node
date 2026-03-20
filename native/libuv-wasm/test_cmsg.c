#include <sys/socket.h>
#include <stdio.h>
int main() {
    struct msghdr m = {0};
    struct cmsghdr *c = CMSG_FIRSTHDR(&m);
    (void)c;
    return 0;
}
