namespace softrobot.util {
  // judge wether obj exists (not undefined and not null)
  export function haveProp(obj: any): boolean {
    return !!obj || obj == 0;
  }

  // limit num between min and max
  export function limitNum(num: number, min: number, max: number): number {
    let res = num;
    res > max ? (res = max) : (res = res);
    res < min ? (res = min) : (res = res);
    return res;
  }

  // convert array buffer to string
  export function ab2str(buf: ArrayBuffer): string {
    return String.fromCharCode.apply(null, new Uint16Array(buf));
  }

  // convert string to array buffer
  export function str2ab(str: string): ArrayBuffer {
    let buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
    let bufView = new Uint16Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
  }

  // convert string to ascii array buffer
  export function str2abAscii(str: string, endFlag: boolean = false): ArrayBuffer {
    let buf;
    if (endFlag) buf = new ArrayBuffer(str.length + 1); // 1 byte for each char
    else buf = new ArrayBuffer(str.length); // 1 byte for each char
    let bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
      bufView[i] = str.charCodeAt(i) >= 128 ? 63 : str.charCodeAt(i);
    }
    if (endFlag) bufView[str.length] = 0;
    return buf;
  }

  // convert array buffer to ascii string
  export function ab2strAscii(buf: ArrayBuffer): string {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
  }

  // encode an array into string
  export function arrayEncoder<T>(array: T[], func: (ele: T) => string, delimiter: string): string {
    let res: string = "";
    if (array.length < 0) return res;
    res += func(array[0]);
    for (let i = 1; i < array.length; i++) {
      res += delimiter + func(array[i]);
    }
    return res;
  }

  // decode a string into an array
  export function arrayDecoder<T>(str: string, func: (ele: string) => T, delimiter: string): T[] {
    let res: T[] = [];
    let strArray: string[] = str.split(delimiter);
    for (let str of strArray) {
      res.push(func(str));
    }
    return res;
  }

  // get interpolated y given (x1,y1), (x2,y2) and x
  export function interpolate(x1: number, y1: number, x2: number, y2: number, x: number): number {
    return (y2 - y1) / (x2 - x1) * (x - x1) + y1;
  }

  export function macAddress2NuibotId(macAddress: ArrayBuffer): string {
    let res = "";
    let dataView = new Uint8Array(macAddress);
    for (let i = 3; i < 6; i++) {
      let str = dataView[i].toString(16);
      if (str.length == 1) str = "0" + str;
      res += str;
    }
    return res.toUpperCase();
  }

  // write to ArrayBuffer
  export enum cDataType {
    uint8 = 0,
    int8 = 1,
    uint16 = 2,
    int16 = 3,
    uint32 = 4,
    int32 = 5,
    string = 6
  }
  // write [num] to [buf] with offset [byteOffset] using type [type], return new [byteOffset]
  export function writeArrayBufferNum(type: cDataType, dataView: DataView, byteOffset: number, num: number): number {
    // fill data
    switch (type) {
      case cDataType.int8:
        dataView.setInt8(byteOffset, num);
        break;
      case cDataType.uint8:
        dataView.setUint8(byteOffset, num);
        break;
      case cDataType.int16:
        dataView.setInt16(byteOffset, num, true);
        break;
      case cDataType.uint16:
        dataView.setUint16(byteOffset, num, true);
        break;
      case cDataType.int32:
        dataView.setInt32(byteOffset, num, true);
        break;
      case cDataType.uint32:
        dataView.setUint32(byteOffset, num, true);
        break;
      case cDataType.string:  // NOTE not supported
        break;
    }

    // add pointer
    switch (type) {
      case cDataType.int8:
      case cDataType.uint8:
        return byteOffset + 1;
      case cDataType.int16:
      case cDataType.uint16:
        return byteOffset + 2;
      case cDataType.int32:
      case cDataType.uint32:
        return byteOffset + 4;
      case cDataType.string:  // NOTE not supported
        return byteOffset;
    }
  }
  export function writeArrayBufferNumArray(type: cDataType, dataView: DataView, byteOffset: number, array: number[]): number {
    for (let i = 0; i < array.length; i++) {
      byteOffset = writeArrayBufferNum(type, dataView, byteOffset, array[i]);
    }
    return byteOffset;
  }
  export function readArrayBufferNum(type: cDataType, obj: any, propName: string, dataView: DataView, byteOffset: number): number {
    switch (type) {
      case cDataType.int8:
        obj[propName] = dataView.getInt8(byteOffset);
        break;
      case cDataType.uint8:
        obj[propName] = dataView.getUint8(byteOffset);
        break;
      case cDataType.int16:
        obj[propName] = dataView.getInt16(byteOffset, true);
        break;
      case cDataType.uint16:
        obj[propName] = dataView.getUint16(byteOffset, true);
        break;
      case cDataType.int32:
        obj[propName] = dataView.getInt32(byteOffset, true);
        break;
      case cDataType.uint32:
        obj[propName] = dataView.getUint32(byteOffset, true);
        break;
      case cDataType.string:  // NOTE not supported
        break;
    }
    switch (type) {
      case cDataType.int8:
      case cDataType.uint8:
        return byteOffset + 1;
      case cDataType.int16:
      case cDataType.uint16:
        return byteOffset + 2;
      case cDataType.int32:
      case cDataType.uint32:
        return byteOffset + 4;
      case cDataType.string:  // NOTE not supported
        return byteOffset;
    }
  }
  export function readArrayBufferNumArray(type: cDataType, obj: any, propName: string, len: number, dataView: DataView, byteOffset: number): number {
    let array = obj[propName] as Array<number>;
    array = [];
    for (let i = 0; i < len; i++) {
      let num: number;
      switch (type) {
        case cDataType.int8:
          num = dataView.getInt8(byteOffset);
          byteOffset += 1;
          break;
        case cDataType.uint8:
          num = dataView.getUint8(byteOffset);
          byteOffset += 1;
          break;
        case cDataType.int16:
          num = dataView.getInt16(byteOffset, true);
          byteOffset += 2;
          break;
        case cDataType.uint16:
          num = dataView.getUint16(byteOffset, true);
          byteOffset += 2;
          break;
        case cDataType.int32:
          num = dataView.getInt32(byteOffset, true);
          byteOffset += 4;
          break;
        case cDataType.uint32:
          num = dataView.getUint32(byteOffset, true);
          byteOffset += 4;
          break;
      }
      array.push(num);
    }
    obj[propName] = array;

    return byteOffset;
  }
  export function readArrayBufferStringAscii(obj: any, propName: string, dataView: DataView, byteOffset: number): number {
    let array: number[] = [];
    while (dataView.getUint8(byteOffset) != 0) {
      array.push(dataView.getUint8(byteOffset));
      byteOffset++;
    }
    byteOffset++;

    obj[propName] = String.fromCharCode.apply(null, array);

    return byteOffset;
  }
}
