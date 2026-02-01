/**
 * Dialog Utilities
 * Helper functions for managing dialog elements with animations
 */

/**
 * Close a dialog with animation
 * Removes the "is-open" class and waits for CSS transition before closing
 *
 * @param dialog - The dialog element to close
 * @param duration - Animation duration in milliseconds (default: 200)
 */
export function closeDialogWithAnimation(dialog: HTMLDialogElement, duration: number = 200): void {
	dialog.classList.remove("is-open");

	setTimeout(() => {
		// Only close if still not open (user might have reopened it)
		if (!dialog.classList.contains("is-open")) {
			dialog.close();
		}
	}, duration);
}

/**
 * Open a dialog with animation
 * Shows the dialog and adds the "is-open" class in the next frame
 *
 * @param dialog - The dialog element to open
 */
export function openDialogWithAnimation(dialog: HTMLDialogElement): void {
	dialog.showModal();
	// Add class in next frame to trigger CSS transition
	requestAnimationFrame(() => {
		dialog.classList.add("is-open");
	});
}

/**
 * Toggle a dialog's open state with animation
 *
 * @param dialog - The dialog element to toggle
 * @param duration - Animation duration in milliseconds (default: 200)
 */
export function toggleDialog(dialog: HTMLDialogElement, duration: number = 200): void {
	if (dialog.open) {
		closeDialogWithAnimation(dialog, duration);
	} else {
		openDialogWithAnimation(dialog);
	}
}
