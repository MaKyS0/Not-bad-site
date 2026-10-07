/**
 * Object URLs for user content.
 *
 * A blob: URL inherits this site's origin. If it holds an SVG/HTML/XML
 * document and the user opens it in a new tab ("Open image in new tab"), its
 * scripts run with full access to the site's storage and service-worker
 * caches. So active content is never exposed through blob: URLs as a
 * renderable type; SVG previews use data: URLs instead, which get an opaque
 * origin and cannot be opened as top-level pages.
 */

const ACTIVE_TYPE = /svg|xml|html|javascript|ecmascript/i;
const ACTIVE_EXT = /\.(?:svgz?|x?html?|xht|xml|xsl|mht|mhtml)$/i;

export function isActiveContent(blob: Blob): boolean {
  return ACTIVE_TYPE.test(blob.type) || (blob instanceof File && !blob.type && ACTIVE_EXT.test(blob.name));
}

/** Blob for URL.createObjectURL: active content is relabelled so it can't render as a page. */
export function inertBlob(blob: Blob): Blob {
  return isActiveContent(blob) ? blob.slice(0, blob.size, 'application/octet-stream') : blob;
}

/** data: URL for displaying an SVG in an <img>. */
export async function svgDataUrl(blob: Blob): Promise<string> {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await blob.text())}`;
}
