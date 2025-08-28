/**
 * Animation utilities for smooth scrolling and other animations
 */

/**
 * Smoothly scrolls to a target element within a scrollable container
 * @param targetElement - The element to scroll to
 * @param scrollContainer - The scrollable container
 * @param offset - Optional offset from the top of the target element
 */
export function smoothScrollTo(
  targetElement: HTMLElement,
  scrollContainer: HTMLElement,
  offset: number = 0
): void {
  if (!targetElement || !scrollContainer) {
    return;
  }

  try {
    const targetRect = targetElement.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    
    // Calculate the scroll position needed to bring the target into view
    const scrollTop = scrollContainer.scrollTop;
    const targetTop = targetRect.top - containerRect.top + scrollTop;
    const finalScrollTop = targetTop - offset;

    // Smooth scroll to the target position
    scrollContainer.scrollTo({
      top: finalScrollTop,
      behavior: 'smooth'
    });
  } catch (error) {
    console.warn('Smooth scroll failed:', error);
    // Fallback to instant scroll
    try {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (fallbackError) {
      console.warn('Fallback scroll also failed:', fallbackError);
    }
  }
}

/**
 * Smoothly scrolls to a target element using scrollIntoView
 * @param targetElement - The element to scroll to
 * @param options - Scroll options
 */
export function smoothScrollIntoView(
  targetElement: HTMLElement,
  options: ScrollIntoViewOptions = { behavior: 'smooth', block: 'nearest' }
): void {
  if (!targetElement) {
    return;
  }

  try {
    targetElement.scrollIntoView(options);
  } catch (error) {
    console.warn('Smooth scroll into view failed:', error);
  }
}

/**
 * Fades in an element with a specified duration
 * @param element - The element to fade in
 * @param duration - Animation duration in milliseconds
 */
export function fadeIn(element: HTMLElement, duration: number = 300): void {
  if (!element) {
    return;
  }

  element.style.opacity = '0';
  element.style.transition = `opacity ${duration}ms ease-in-out`;
  
  // Trigger reflow
  element.offsetHeight;
  
  element.style.opacity = '1';
}

/**
 * Fades out an element with a specified duration
 * @param element - The element to fade out
 * @param duration - Animation duration in milliseconds
 */
export function fadeOut(element: HTMLElement, duration: number = 300): Promise<void> {
  return new Promise((resolve) => {
    if (!element) {
      resolve();
      return;
    }

    element.style.transition = `opacity ${duration}ms ease-in-out`;
    element.style.opacity = '0';
    
    setTimeout(() => {
      resolve();
    }, duration);
  });
}
