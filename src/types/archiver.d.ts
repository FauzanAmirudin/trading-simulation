declare module "archiver" {
  import { Transform, Writable } from "stream";

  export interface ArchiverOptions {
    zlib?: {
      level?: number;
    };
  }

  export class ZipArchive extends Transform {
    constructor(options?: ArchiverOptions);
    append(source: Buffer | NodeJS.ReadableStream | string, data: { name: string; [key: string]: unknown }): this;
    finalize(): Promise<void>;
  }

  export class Archiver extends Transform {
    constructor(format: string, options?: ArchiverOptions);
    append(source: Buffer | NodeJS.ReadableStream | string, data: { name: string; [key: string]: unknown }): this;
    finalize(): Promise<void>;
  }

  const archiver: {
    (format: string, options?: ArchiverOptions): Archiver;
    create(format: string, options?: ArchiverOptions): Archiver;
    ZipArchive: typeof ZipArchive;
    Archiver: typeof Archiver;
  };

  export default archiver;
}
