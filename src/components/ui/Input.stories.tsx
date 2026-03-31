import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'Base/Input',
  component: Input,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = { args: { placeholder: 'Enter text...' } };
export const Disabled: Story = { args: { placeholder: 'Disabled', disabled: true } };
export const WithValue: Story = { args: { defaultValue: 'Hello world' } };
