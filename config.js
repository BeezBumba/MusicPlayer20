// Default cover art (inline svg for when no cover is available)
export const defaultCoverArt = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"%3E%3Crect width="200" height="200" fill="%23333"%2F%3E%3Ccircle cx="100" cy="100" r="50" fill="%23555"%2F%3E%3Cpath d="M80 80 L80 120 L130 100 Z" fill="%23777"%2F%3E%3C%2Fsvg%3E';

// Player options that can be customized
export const playerOptions = {
    // Time to wait before advancing to the next song (in milliseconds)
    autoplayDelay: 500,
    
    // Animation speed for progress bar (in milliseconds)
    progressAnimationSpeed: 100,
    
    // Default volume (0-1)
    defaultVolume: 0.7,
    
    // Crossfade duration between songs (in milliseconds)
    crossfadeDuration: 1000,
    
    /* @tweakable border radius for cover art (0px = square, 50% = circle) */
    coverBorderRadius: '10px',
    
    /* @tweakable border radius for small cover art in playlist and popup (0px = square, 50% = circle) */
    coverBorderRadiusSmall: '4px'
};