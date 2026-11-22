/** Leading bytes of binary formats that a renamed file can carry under a text extension. */
export const BINARY_SIGNATURES: readonly {
  format: string;
  bytes: readonly number[];
}[] = [
  { format: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  { format: 'zip', bytes: [0x50, 0x4b, 0x03, 0x04] },
  { format: 'png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { format: 'jpeg', bytes: [0xff, 0xd8, 0xff] },
  { format: 'gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { format: 'ole', bytes: [0xd0, 0xcf, 0x11, 0xe0] },
];
