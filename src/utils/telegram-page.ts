/** Validate only structures already consumed by the scraper, not an assumed empty-feed marker. */
export function assertTelegramPage(title: string, messageIds: Array<string | undefined>, channel: string): void {
    if (!title.trim()) throw new Error("Invalid Telegram channel page");
    for (const value of messageIds) {
        const [username, id, extra] = (value || "").split("/");
        if (username.toLowerCase() !== channel.toLowerCase() || !/^[1-9]\d*$/.test(id || "") || extra !== undefined) {
            throw new Error("Invalid Telegram message envelope");
        }
    }
}
