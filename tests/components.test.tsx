/**
 * Component rendering tests for ProgressBar, Toolbar search, and FileBrowser column headers.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProgressBar } from '../src/components/ProgressBar';
import { Toolbar } from '../src/components/Toolbar';

describe('ProgressBar', () => {
  it('renders upload label and filename', () => {
    render(<ProgressBar operation="upload" fileName="test.txt" percent={42} />);
    expect(screen.getByText('Uploading')).toBeInTheDocument();
    expect(screen.getByText('test.txt')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('renders download label', () => {
    render(<ProgressBar operation="download" fileName="data.zip" percent={100} />);
    expect(screen.getByText('Downloading')).toBeInTheDocument();
    expect(screen.getByText('data.zip')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});

describe('Toolbar search', () => {
  const defaultProps = {
    onUpload: vi.fn(),
    onRefresh: vi.fn(),
    onDelete: vi.fn(),
    onCreateFolder: vi.fn(),
    hasSelection: false,
    loading: false,
    onExpandAll: vi.fn(),
    onCollapseAll: vi.fn(),
    searchQuery: '',
    onSearchChange: vi.fn(),
  };

  it('renders search input', () => {
    render(<Toolbar {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search files...')).toBeInTheDocument();
  });

  it('calls onSearchChange when typing', () => {
    const onSearchChange = vi.fn();
    render(<Toolbar {...defaultProps} onSearchChange={onSearchChange} />);
    const input = screen.getByPlaceholderText('Search files...');
    fireEvent.change(input, { target: { value: 'test' } });
    expect(onSearchChange).toHaveBeenCalledWith('test');
  });

  it('shows clear button when query is non-empty', () => {
    render(<Toolbar {...defaultProps} searchQuery="hello" />);
    const clearBtn = screen.getByTitle('Clear search');
    expect(clearBtn).toBeInTheDocument();
  });

  it('does not show clear button when query is empty', () => {
    render(<Toolbar {...defaultProps} searchQuery="" />);
    expect(screen.queryByTitle('Clear search')).not.toBeInTheDocument();
  });

  it('clears search on clear button click', () => {
    const onSearchChange = vi.fn();
    render(<Toolbar {...defaultProps} searchQuery="test" onSearchChange={onSearchChange} />);
    fireEvent.click(screen.getByTitle('Clear search'));
    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('shows target folder name in upload button', () => {
    render(<Toolbar {...defaultProps} targetFolderName="myFolder" />);
    expect(screen.getByTitle('Upload files into myFolder')).toBeInTheDocument();
  });

  it('shows Delete Selected when hasSelection is true', () => {
    render(<Toolbar {...defaultProps} hasSelection={true} />);
    expect(screen.getByText('Delete Selected')).toBeInTheDocument();
  });

  it('hides Delete Selected when hasSelection is false', () => {
    render(<Toolbar {...defaultProps} hasSelection={false} />);
    expect(screen.queryByText('Delete Selected')).not.toBeInTheDocument();
  });
});
