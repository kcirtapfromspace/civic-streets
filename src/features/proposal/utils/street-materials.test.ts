import { describe, expect, it, vi } from 'vitest';
import {
  createMaterialImage,
  MAP_MATERIALS,
  MATERIAL_FOR_ELEMENT,
  materialImageId,
  type MaterialName,
} from './street-materials';

const materials = Object.keys(MAP_MATERIALS) as MaterialName[];
type MaterialImage = ReturnType<typeof createMaterialImage>;

function pixel(image: MaterialImage, x: number, y: number): number {
  return image.data[((y % image.height) * image.width + (x % image.width)) * 4 + 1];
}

/** Mean squared contrast at a wrapped spatial separation. */
function contrast(image: MaterialImage, distance: number): number {
  let total = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      total += (pixel(image, x, y) - pixel(image, x + distance, y)) ** 2;
      total += (pixel(image, x, y) - pixel(image, x, y + distance)) ** 2;
    }
  }
  return total / (image.width * image.height * 2);
}

describe('street map materials', () => {
  it('maps every street element to a legible material, including concrete curbs', () => {
    expect(MATERIAL_FOR_ELEMENT).toEqual({
      sidewalk: 'concrete',
      'planting-strip': 'planted',
      'furniture-zone': 'pavers',
      'bike-lane': 'cycle',
      'bike-lane-protected': 'cycle',
      buffer: 'concrete',
      'parking-lane': 'asphalt',
      'travel-lane': 'asphalt',
      'turn-lane': 'asphalt',
      'transit-lane': 'transit',
      median: 'planted',
      curb: 'concrete',
    });
    expect(new Set(Object.values(MATERIAL_FOR_ELEMENT))).toEqual(new Set(materials));
  });

  it.each(materials)(
    '%s is a small, opaque, power-of-two RGBA tile with restrained variation',
    (material) => {
      const image = createMaterialImage(material);
      expect(image.width).toBe(image.height);
      expect(image.width).toBeGreaterThanOrEqual(64);
      expect(image.width).toBeLessThanOrEqual(128);
      expect(image.width & (image.width - 1)).toBe(0);
      expect(image.data).toBeInstanceOf(Uint8Array);
      expect(image.data).toHaveLength(image.width * image.height * 4);
      const base = [1, 3, 5].map((offset) =>
        Number.parseInt(MAP_MATERIALS[material].color.slice(offset, offset + 2), 16),
      );
      const tones = new Set<number>();
      let largestDeviation = 0;
      let totalDeviation = 0;
      for (let index = 0; index < image.data.length; index += 4) {
        expect(image.data[index + 3]).toBe(255);
        tones.add(image.data[index]);
        for (let channel = 0; channel < 3; channel++) {
          const difference = image.data[index + channel] - base[channel];
          largestDeviation = Math.max(largestDeviation, Math.abs(difference));
          totalDeviation += difference;
        }
      }
      expect(tones.size).toBeGreaterThan(8);
      expect(largestDeviation).toBeLessThanOrEqual(20);
      expect(Math.abs(totalDeviation / (image.width * image.height * 3))).toBeLessThan(5);
      expect(MAP_MATERIALS[material].edge).toMatch(/^#[0-9a-f]{6}$/);
      expect(MAP_MATERIALS[material].edge).not.toBe(MAP_MATERIALS[material].color);
    },
  );

  it.each(materials)(
    '%s is deterministic, independently allocated, and identified by a stable versioned name',
    (material) => {
      const random = vi.spyOn(Math, 'random').mockImplementation(() => {
        throw new Error('Textures must not use ambient randomness');
      });
      try {
        const first = createMaterialImage(material);
        const second = createMaterialImage(material);
        expect(first).toEqual(second);
        expect(first.data).not.toBe(second.data);
        first.data.fill(0);
        expect(createMaterialImage(material)).toEqual(second);
        expect(materialImageId(material)).toBe(`curbwise-material-v1-${material}`);
      } finally {
        random.mockRestore();
      }
    },
  );

  it.each(materials)('%s wraps without a stronger seam or a directional grid', (material) => {
    const image = createMaterialImage(material);
    let boundaryContrast = 0;
    let horizontalContrast = 0;
    let verticalContrast = 0;
    for (let y = 0; y < image.height; y++) {
      boundaryContrast += (pixel(image, 0, y) - pixel(image, image.width - 1, y)) ** 2;
      boundaryContrast += (pixel(image, y, 0) - pixel(image, y, image.height - 1)) ** 2;
      for (let x = 0; x < image.width; x++) {
        horizontalContrast += (pixel(image, x, y) - pixel(image, x + 1, y)) ** 2;
        verticalContrast += (pixel(image, x, y) - pixel(image, x, y + 1)) ** 2;
      }
    }
    const averageContrast = contrast(image, 1);
    expect(boundaryContrast / (image.width + image.height)).toBeLessThan(averageContrast * 1.6);
    expect(horizontalContrast / verticalContrast).toBeGreaterThan(0.65);
    expect(horizontalContrast / verticalContrast).toBeLessThan(1.55);
  });

  it('uses coherent organic patches for planting and fine grain for painted lanes', () => {
    const planted = createMaterialImage('planted');
    const cycle = createMaterialImage('cycle');
    const transit = createMaterialImage('transit');
    expect(contrast(planted, 8)).toBeGreaterThan(contrast(planted, 1) * 6);
    expect(contrast(cycle, 8)).toBeLessThan(contrast(cycle, 1) * 1.6);
    expect(contrast(transit, 8)).toBeLessThan(contrast(transit, 1) * 1.6);
    expect(contrast(planted, 1)).toBeLessThan(contrast(cycle, 1) / 3);
    expect(contrast(planted, 8)).toBeGreaterThan(contrast(cycle, 8) * 2);
  });
});
