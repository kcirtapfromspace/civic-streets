import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommentThread } from '../CommentThread';
import { DesignCard } from '../DesignCard';
import { VoteButton } from '../VoteButton';
import { MOCK_DESIGNS, type MockComment } from '../mock-data';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('community discussion interactions', () => {
  it('requires a nonblank comment, trims submitted text, and supports cancelling or posting a reply', () => {
    render(<CommentThread hotspotId="crossing" comments={[]} />);
    expect(screen.getByText(/No comments yet/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Add a comment...'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post Comment' }));
    expect(screen.getByRole('heading', { name: 'Comments (0)' })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Add a comment...'), {
      target: { value: '  Need a curb ramp  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Post Comment' }));
    expect(screen.getByText('Need a curb ramp')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add a comment...')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByPlaceholderText('Write a reply...')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    const replyForm = screen.getByPlaceholderText('Write a reply...').parentElement!;
    fireEvent.click(within(replyForm).getByRole('button', { name: 'Reply' }));
    expect(screen.getByRole('heading', { name: 'Comments (1)' })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Write a reply...'), {
      target: { value: '  Agreed  ' },
    });
    fireEvent.click(within(replyForm).getByRole('button', { name: 'Reply' }));
    expect(screen.getByText('Agreed')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Comments (2)' })).toBeInTheDocument();
    const upvote = screen.getAllByRole('button', { name: 'Upvote comment' })[0];
    fireEvent.click(upvote);
    expect(upvote).toHaveAttribute('aria-pressed', 'true');
    expect(upvote).toHaveTextContent('1');
    fireEvent.click(upvote);
    expect(upvote).toHaveAttribute('aria-pressed', 'false');
    expect(upvote).toHaveTextContent('0');
  });
  it('renders nested replies with their author and age while limiting further reply depth', () => {
    const now = Date.now();
    const comments: MockComment[] = [0, 1, 2, 3, 4].map((index) => ({
      id: String(index),
      parentId: index === 0 || index === 4 ? null : String(index - 1),
      hotspotId: 'crossing',
      authorId: index === 0 ? 'unknown-user' : 'u2',
      body: `Comment ${index}`,
      upvotes: index,
      createdAt: now - [30_000, 5 * 60_000, 2 * 3_600_000, 5 * 86_400_000, 60 * 86_400_000][index],
    }));
    render(<CommentThread hotspotId="crossing" comments={comments} />);
    for (const age of ['just now', '5m ago', '2h ago', '5d ago', '2mo ago'])
      expect(screen.getByText(age)).toBeInTheDocument();
    expect(screen.getByText('Anonymous')).toBeInTheDocument();
    expect(screen.getAllByText('Maria T.')).toHaveLength(4);
    expect(screen.getAllByRole('button', { name: 'Reply' })).toHaveLength(4);
  });
});

describe('design cards and voting', () => {
  it('toggles a vote off and switches its direction without accumulating repeated clicks', () => {
    const onVote = vi.fn();
    render(<VoteButton upvotes={10} downvotes={2} horizontal onVote={onVote} />);
    expect(screen.getByLabelText('8 votes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Upvote' }));
    expect(screen.getByLabelText('9 votes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Upvote' }));
    expect(screen.getByLabelText('8 votes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Downvote' }));
    expect(screen.getByLabelText('7 votes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Upvote' }));
    expect(screen.getByLabelText('9 votes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Downvote' }));
    fireEvent.click(screen.getByRole('button', { name: 'Downvote' }));
    expect(screen.getByLabelText('8 votes')).toBeInTheDocument();
    expect(onVote.mock.calls).toEqual([[1], [1], [-1], [1], [-1], [-1]]);
  });
  it.each([
    [30_000, 'just now'],
    [5 * 60_000, '5m ago'],
    [2 * 3_600_000, '2h ago'],
    [5 * 86_400_000, '5d ago'],
    [60 * 86_400_000, '2mo ago'],
  ])('shows the saved design age after %i ms', (age, label) => {
    const onOpen = vi.fn();
    const design = {
      ...MOCK_DESIGNS[0],
      createdAt: Date.now() - age,
      address: age === 30_000 ? '' : 'Colfax, Denver',
      authorId: age === 30_000 ? 'missing' : 'u1',
      prowagPass: age === 30_000,
      nactoPass: age !== 30_000,
      elements: [
        { name: 'Sidewalk', proportion: 0.9, color: '#333333' },
        { name: 'Buffer', proportion: 0.1 / 2, color: '#eeeeee' },
      ],
    };
    render(<DesignCard design={design} onOpenEditor={onOpen} />);
    expect(screen.getByText(new RegExp(label))).toHaveTextContent(
      age === 30_000 ? 'Anonymous' : 'Alex R.',
    );
    expect(screen.getByTitle('Sidewalk (90%)')).toHaveStyle({ width: '90%' });
    expect(screen.getByTitle('Buffer (5%)')).toHaveTextContent('');
    expect(screen.getByText(`PROWAG ${design.prowagPass ? '✓' : '✗'}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open in Editor' }));
    expect(onOpen).toHaveBeenCalledWith(design.id);
    fireEvent.click(screen.getByRole('button', { name: 'Upvote' }));
    fireEvent.click(screen.getByRole('button', { name: 'Downvote' }));
  });
});
