import {
    hasCodyMarker,
    hasReviewMarker,
    isForceReviewCommand,
    isHeavyReviewCommand,
    isCodyMentionNonReview,
    isReviewCommand,
    parseReviewDirective,
} from '@libs/common/utils/codeManagement/codeCommentMarkers';

describe('codeCommentMarkers', () => {
    describe('isReviewCommand', () => {
        it('should return true for "@cody review"', () => {
            expect(isReviewCommand('@cody review')).toBe(true);
        });

        it('should return true for "@cody start-review"', () => {
            expect(isReviewCommand('@cody start-review')).toBe(true);
        });

        it('should return true with leading whitespace', () => {
            expect(isReviewCommand('  @cody review')).toBe(true);
            expect(isReviewCommand('\t@cody start-review')).toBe(true);
        });

        it('should return true case-insensitive', () => {
            expect(isReviewCommand('@CODY REVIEW')).toBe(true);
            expect(isReviewCommand('@Cody Start-Review')).toBe(true);
        });

        it('should return true with text after command', () => {
            expect(isReviewCommand('@cody review please')).toBe(true);
            expect(isReviewCommand('@cody start-review now')).toBe(true);
        });

        it('should return false for partial matches like "reviewing"', () => {
            expect(isReviewCommand('@cody reviewing')).toBe(false);
        });

        it('should return false for other @cody commands', () => {
            expect(isReviewCommand('@cody help')).toBe(false);
            expect(isReviewCommand('@cody explain')).toBe(false);
            expect(isReviewCommand('@cody what is this?')).toBe(false);
        });

        it('should return false when @cody is not at the start', () => {
            expect(isReviewCommand('hey @cody review')).toBe(false);
            expect(isReviewCommand('please @cody start-review')).toBe(false);
        });

        it('should return false for null/undefined', () => {
            expect(isReviewCommand(null)).toBe(false);
            expect(isReviewCommand(undefined)).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(isReviewCommand('')).toBe(false);
        });
    });

    describe('hasReviewMarker', () => {
        it('should return true for standard cody-codereview marker', () => {
            expect(hasReviewMarker('<!-- cody-codereview -->')).toBe(true);
        });

        it('should return true with varying whitespace', () => {
            expect(hasReviewMarker('<!--cody-codereview-->')).toBe(true);
            expect(hasReviewMarker('<!--  cody-codereview  -->')).toBe(true);
        });

        it('should return true when marker is embedded in text', () => {
            expect(
                hasReviewMarker('Some text <!-- cody-codereview --> more text'),
            ).toBe(true);
        });

        it('should return true case-insensitive', () => {
            expect(hasReviewMarker('<!-- CODY-CODEREVIEW -->')).toBe(true);
            expect(hasReviewMarker('<!-- Cody-CodeReview -->')).toBe(true);
        });

        it('should return false when marker is not present', () => {
            expect(hasReviewMarker('no marker here')).toBe(false);
            expect(hasReviewMarker('<!-- other-marker -->')).toBe(false);
        });

        it('should return false for null/undefined', () => {
            expect(hasReviewMarker(null)).toBe(false);
            expect(hasReviewMarker(undefined)).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(hasReviewMarker('')).toBe(false);
        });
    });

    describe('isCodyMentionNonReview', () => {
        it('should return true for @cody with other commands', () => {
            expect(isCodyMentionNonReview('@cody help')).toBe(true);
            expect(isCodyMentionNonReview('@cody explain this')).toBe(true);
            expect(isCodyMentionNonReview('@cody what is this?')).toBe(true);
        });

        it('should return true with leading whitespace', () => {
            expect(isCodyMentionNonReview('  @cody help')).toBe(true);
        });

        it('should return false for review commands', () => {
            expect(isCodyMentionNonReview('@cody review')).toBe(false);
            expect(isCodyMentionNonReview('@cody start-review')).toBe(false);
        });

        it('should return false for review commands case-insensitive', () => {
            expect(isCodyMentionNonReview('@cody REVIEW')).toBe(false);
            expect(isCodyMentionNonReview('@CODY start-review')).toBe(false);
        });

        it('should return false when @cody is not at the start', () => {
            expect(isCodyMentionNonReview('hey @cody help')).toBe(false);
        });

        it('should return false for null/undefined', () => {
            expect(isCodyMentionNonReview(null)).toBe(false);
            expect(isCodyMentionNonReview(undefined)).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(isCodyMentionNonReview('')).toBe(false);
        });

        it('should return true for @cody alone (just mention)', () => {
            expect(isCodyMentionNonReview('@cody')).toBe(true);
        });
    });

    describe('hasCodyMarker', () => {
        it('should return true for Code Review Completed marker', () => {
            expect(hasCodyMarker('## Code Review Completed! 🔥')).toBe(true);
        });

        it('should return true for critical issue marker', () => {
            expect(
                hasCodyMarker('# Found critical issues please fix them'),
            ).toBe(true);
        });

        it('should return true for @cody start patterns', () => {
            expect(hasCodyMarker('@cody start')).toBe(true);
            expect(hasCodyMarker('@cody start-review')).toBe(true);
        });

        it('should return true for @cody review pattern', () => {
            expect(hasCodyMarker('@cody review')).toBe(true);
        });

        it('should return true for cody without @ prefix', () => {
            expect(hasCodyMarker('cody start')).toBe(true);
            expect(hasCodyMarker('cody review')).toBe(true);
        });

        it('should return true for start-review alone', () => {
            expect(hasCodyMarker('start-review')).toBe(true);
        });

        it('should return false for regular comments', () => {
            expect(hasCodyMarker('This is a regular comment')).toBe(false);
            expect(hasCodyMarker('Please fix this bug')).toBe(false);
        });

        it('should return false for null/undefined', () => {
            expect(hasCodyMarker(null)).toBe(false);
            expect(hasCodyMarker(undefined)).toBe(false);
        });
    });

    describe('isForceReviewCommand', () => {
        it('should return true for "@cody review --force"', () => {
            expect(isForceReviewCommand('@cody review --force')).toBe(true);
        });

        it('should return true for "@cody start-review --force"', () => {
            expect(isForceReviewCommand('@cody start-review --force')).toBe(
                true,
            );
        });

        it('should accept single-dash and trailing text', () => {
            expect(isForceReviewCommand('@cody review -force')).toBe(true);
            expect(
                isForceReviewCommand('@cody review --force please retry'),
            ).toBe(true);
        });

        it('should be case-insensitive', () => {
            expect(isForceReviewCommand('@CODY REVIEW --FORCE')).toBe(true);
        });

        it('should return false for plain review commands', () => {
            expect(isForceReviewCommand('@cody review')).toBe(false);
            expect(isForceReviewCommand('@cody start-review')).toBe(false);
        });

        it('should not match "force" embedded mid-word', () => {
            expect(isForceReviewCommand('@cody review --forced')).toBe(false);
        });

        it('should return false for null/undefined/empty', () => {
            expect(isForceReviewCommand(null)).toBe(false);
            expect(isForceReviewCommand(undefined)).toBe(false);
            expect(isForceReviewCommand('')).toBe(false);
        });

        it('isReviewCommand should still match when --force is present', () => {
            // Force is a *flag on top of* a review command; both helpers
            // must agree so the handler still routes it as a review.
            expect(isReviewCommand('@cody review --force')).toBe(true);
            expect(isReviewCommand('@cody start-review --force')).toBe(true);
        });
    });

    describe('isHeavyReviewCommand', () => {
        it('matches --heavy in any position', () => {
            expect(isHeavyReviewCommand('@cody review --heavy')).toBe(true);
            expect(isHeavyReviewCommand('@cody review auth --heavy')).toBe(true);
            expect(
                isHeavyReviewCommand('@cody review --heavy --force'),
            ).toBe(true);
        });

        it('does NOT match a bare `heavy` (dash required, like --force)', () => {
            expect(isHeavyReviewCommand('@cody review heavy')).toBe(false);
            expect(
                isHeavyReviewCommand('@cody review heavy checkout path'),
            ).toBe(false);
        });
    });

    describe('parseReviewDirective', () => {
        it('returns the focus text for a plain directive', () => {
            expect(parseReviewDirective('@cody review auth logic')).toBe(
                'auth logic',
            );
        });

        it('returns undefined when there is no directive', () => {
            expect(parseReviewDirective('@cody review')).toBeUndefined();
            expect(parseReviewDirective('@cody review --force')).toBeUndefined();
            expect(parseReviewDirective('@cody review --heavy')).toBeUndefined();
        });

        it('strips flags whatever their position (leading, trailing, multiple)', () => {
            expect(parseReviewDirective('@cody review --heavy auth')).toBe(
                'auth',
            );
            expect(parseReviewDirective('@cody review auth --heavy')).toBe(
                'auth',
            );
            expect(
                parseReviewDirective('@cody review auth --heavy --force'),
            ).toBe('auth');
            expect(
                parseReviewDirective('@cody review --force auth --heavy'),
            ).toBe('auth');
        });

        it('does not strip focus words that merely contain heavy/force', () => {
            expect(
                parseReviewDirective('@cody review the forced retries path'),
            ).toBe('the forced retries path');
        });
    });

    describe('integration: command detection consistency', () => {
        it('should correctly identify review commands vs mentions', () => {
            const reviewCommands = [
                '@cody review',
                '@cody start-review',
                '  @cody review',
                '@CODY REVIEW',
            ];

            const nonReviewMentions = [
                '@cody help',
                '@cody explain',
                '@cody what is this code doing?',
                '@cody',
            ];

            reviewCommands.forEach((cmd) => {
                expect(isReviewCommand(cmd)).toBe(true);
                expect(isCodyMentionNonReview(cmd)).toBe(false);
            });

            nonReviewMentions.forEach((mention) => {
                expect(isReviewCommand(mention)).toBe(false);
                expect(isCodyMentionNonReview(mention)).toBe(true);
            });
        });

        it('should handle edge cases consistently', () => {
            // "reviewing" should not match as review command
            expect(isReviewCommand('@cody reviewing')).toBe(false);
            expect(isCodyMentionNonReview('@cody reviewing')).toBe(true);

            // "review-something" should not match as review command
            expect(isReviewCommand('@cody review-code')).toBe(false);
            expect(isCodyMentionNonReview('@cody review-code')).toBe(true);
        });
    });
});
