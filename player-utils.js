// Utility functions for player operations
import { playerOptions } from './config.js';

// Format time in minutes:seconds
export function formatTime(time) {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

// Get random index for shuffle
export function getRandomIndex(currentIndex, length) {
  if (length <= 1) return 0;
  
  let randomIndex;
  do {
    randomIndex = Math.floor(Math.random() * length);
  } while (randomIndex === currentIndex);
  
  return randomIndex;
}

// Class to manage audio transitions
export class AudioTransitionManager {
  constructor() {
    this.nextAudioPlayer = new Audio();
    this.currentFadeOutInterval = null;
    this.currentFadeInInterval = null;
    this.defaultVolume = playerOptions.defaultVolume;
    
    // Flag to track if transition is in progress
    this.transitionInProgress = false;
  }

  // Clean up event listeners and reset state
  cleanUp() {
    // Clear any active intervals
    if (this.currentFadeOutInterval) {
      clearInterval(this.currentFadeOutInterval);
      this.currentFadeOutInterval = null;
    }
    
    if (this.currentFadeInInterval) {
      clearInterval(this.currentFadeInInterval);
      this.currentFadeInInterval = null;
    }
    
    // Reset next audio player
    this.nextAudioPlayer.pause();
    this.nextAudioPlayer.src = '';
    
    // Reset transition flag
    this.transitionInProgress = false;
  }

  // Smooth transition to next song
  smoothTransitionToNext(currentPlayer, currentSongIndex, songs, isShuffle, getRandomIndex, playHistory, updateSongUI, finalizeSongTransition) {
    // Don't start a new transition if one is already in progress
    if (this.transitionInProgress || songs.length <= 1) {
      return null; // Signal to use regular playNext
    }
    
    // Set transition flag
    this.transitionInProgress = true;
    
    // Determine next song index
    playHistory.push(currentSongIndex);
    let nextIndex;
    if (isShuffle) {
      nextIndex = getRandomIndex(currentSongIndex, songs.length);
    } else {
      nextIndex = (currentSongIndex + 1) % songs.length;
    }
    
    const nextSong = songs[nextIndex];
    if (!nextSong || !nextSong.url) {
      this.transitionInProgress = false;
      return null; // Signal to use regular playNext
    }
    
    // Prepare next audio player
    this.nextAudioPlayer.src = nextSong.url;
    this.nextAudioPlayer.volume = 0;
    
    // Remove any existing event listeners
    this.nextAudioPlayer.onloadedmetadata = null;
    
    // Load metadata and start playing
    this.nextAudioPlayer.addEventListener('loadedmetadata', () => {
      // Start playing the next song silently
      this.nextAudioPlayer.play().catch(err => {
        console.error("Error playing next song:", err);
        this.transitionInProgress = false;
      });
      
      // Start fadeout of current song and fadein of next song
      this.startCrossFade(currentPlayer, nextIndex, updateSongUI, finalizeSongTransition);
    }, { once: true });
    
    this.nextAudioPlayer.load();
    return nextIndex;
  }

  // Handle crossfade between songs
  startCrossFade(currentPlayer, nextIndex, updateSongUI, finalizeSongTransition) {
    const fadeSteps = 20; // Number of steps in the fade
    const stepDuration = playerOptions.crossfadeDuration / fadeSteps;
    const volumeStep = this.defaultVolume / fadeSteps;
    let step = 0;
    
    // Update UI for next song (cover art, title, etc) with visual fade effect
    updateSongUI(nextIndex, true);
    
    // Clear any existing fade intervals
    if (this.currentFadeOutInterval) clearInterval(this.currentFadeOutInterval);
    if (this.currentFadeInInterval) clearInterval(this.currentFadeInInterval);
    
    // Create crossfade effect
    this.currentFadeOutInterval = setInterval(() => {
      step++;
      if (step >= fadeSteps) {
        currentPlayer.pause();
        clearInterval(this.currentFadeOutInterval);
        this.currentFadeOutInterval = null;
        
        // Ensure next audio has full volume
        this.nextAudioPlayer.volume = this.defaultVolume;
        
        // Complete the song change
        finalizeSongTransition(nextIndex, this.nextAudioPlayer);
        
        // Reset transition flag
        this.transitionInProgress = false;
      } else {
        // Fade out current song
        currentPlayer.volume = Math.max(0, this.defaultVolume - (step * volumeStep));
        
        // Fade in next song
        this.nextAudioPlayer.volume = Math.min(this.defaultVolume, step * volumeStep);
      }
    }, stepDuration);
  }
}