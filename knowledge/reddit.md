# Reddit Navigation Guide

## URLs
- Subreddit: `reddit.com/r/<subreddit>`
- Post: `reddit.com/r/<subreddit>/comments/<id>/<slug>`
- User: `reddit.com/u/<username>` or `reddit.com/user/<username>`

## Navigation
- Front page shows "Hot" posts by default
- Sort options: Hot, New, Top, Rising (tabs at top of feed)
- Infinite scroll - use `scroll bottom` and `wait 2000` to load more posts

## Post Feed Selectors
- Post container: `[data-testid="post-container"]` or `article`
- Post title: `h3` within post container, or `[data-testid="post-title"]`
- Post flair: `[data-testid="flair"]` (colored tags like "YOLO", "DD", "Loss")
- Upvote count: `[data-testid="vote-count"]` or score display
- Comment count: usually near upvotes, contains "comments" text
- Post time: relative time like "5 hours ago"

## Reading Posts
- Click post title to open full post
- Post body: `[data-testid="post-body"]` or `.Post` content area
- Images/media often lazy-loaded, may need to wait
- Use `text` command to get visible content

## Comments
- Comments section loads below post
- Individual comments: `.Comment` or `[data-testid="comment"]`
- Nested replies are indented
- "Continue this thread" links for deep nesting

## Gotchas
- Cookie consent banner may appear - look for accept button
- NSFW subreddits show age gate - click "Yes" to continue
- Reddit may show login prompts - can usually dismiss or scroll past
- New Reddit vs Old Reddit: selectors above are for new Reddit
- Rate limiting possible if too many rapid requests
- Some content behind "Click to see spoiler" or NSFW blur

## Useful Patterns
```bash
# Navigate to subreddit
ghast control --server $PORT "navigate https://reddit.com/r/wallstreetbets"

# Wait for content to load
ghast control --server $PORT "wait 2000"

# Get visible text to scan posts
ghast control --server $PORT "text"

# Scroll for more posts
ghast control --server $PORT "scroll bottom"
ghast control --server $PORT "wait 2000"

# Get all links to find post URLs
ghast control --server $PORT "links"
```

## Post Flairs (r/wallstreetbets specific)
- YOLO - High risk all-in trades
- DD - Due Diligence research posts
- Gain - Profit screenshots
- Loss - Loss screenshots
- Meme - Memes/jokes
- Discussion - General discussion
- News - Market news
- Chart - Technical analysis
