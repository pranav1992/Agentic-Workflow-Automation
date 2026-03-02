def word_search(board, word):
    ROW, COL = len(board), len(board[0])
    dimantions = [(0, 1), (1, 0), (0, -1), (-1, 0)]
    len_word = len(word)
    visited = set()

    def dfs(r, c, i):
        if i == len_word:
            return True

        if (r, c) in visited:
            return False

        visited.add((r, c))

        if board[r][c] == word[i] or word[i] == "*":
            for row, col in dimantions:
                if row+r < 0 or row+r == ROW or col+c < 0 or col+c == COL:
                    continue
                if dfs(row+r, col+c, i+1):
                    return True
        visited.remove((r, c))
        return False
    for r in range(ROW):
        for c in range(COL):
            if dfs(r, c, 0):
                return True
    return False


if __name__ == "__main__":
    board = [
    ["A","B"],
    ["C","D"]
    ]

    word = "A*C"
    result = word_search(board, word)
    print(result)
