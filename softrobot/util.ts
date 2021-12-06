namespace softrobot.util {
  export namespace mobx {
    export type Boxed<T> = {
      get: () => T,
      set: (value: T) => void
    }
    export function toBoxed<T>(value: T): Boxed<T> {
      let _val = value;
      return {
        get: () => (_val),
        set: (val: T) => _val = val
      }
    }
  }

  // judge wether obj exists (not undefined and not null)
  export function haveProp(obj: any): boolean {
    return !!obj || obj == 0;
  }

  /**
    * combine props of an object array to an prop array
    * @description assume object have property p, this function convert object[] into p[]
    * @param name one property (type T) name of object
    * @param array array of object
    */
  export function getPropArray<T>(name: string, array: Array<any>): Array<T> {
    if (!(name in array[0])) {
        console.error("No property named " + name + "in array");
        return null;
    }

    let res: Array<T> = new Array<T>();
    for (let i: number = 0; i < array.length; i++) {
        res.push(array[i][name] as T);
    }
    return res;
  }
  /**
    * set props of an object array to an prop array
    * @param name name of the property
    * @param pArray property value array
    * @param oArray object array
    */
  export function setPropArray<T>(name: string, pArray: Array<T>, oArray: Array<any>) {
      if (pArray.length != oArray.length) {
          console.error("Not equivalent length array");
          return;
      }
      if (!(name in oArray[0])) {
          console.error("No property named " + name + "in array");
          return;
      }

      let res = oArray;
      for (let index = 0; index < res.length; index++) {
          res[index][name] = pArray[index];
      }
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
  export function getURLParam(key: string): string {
    let url: URL = new URL(window.location.href);
    return url.searchParams.get(key);
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

  // storage
  export interface IMapContents<T> {
      [key: number]: T
  }
  export class MyMap<T> {
      private MAX_SIZE = 100;
      public contents: IMapContents<T> = {};
      private size = 0;
      private currentKey: number = -1;
      private keyGenerator(): number {
      while (!!this.contents[++this.currentKey]) {
          if (this.currentKey == this.MAX_SIZE - 1) this.currentKey = -1;
      }
      return this.currentKey;
      }
      /**
      * add content to the map
      * @param content the content to be added into the map
      * @returns the key of the added content, return -1 if its full
      */
      push(content: T): number {
      if (this.size == this.MAX_SIZE) return -1;
      let key = this.keyGenerator();
      this.contents[key] = content;
      return key;
      }
      /**
      * delete one content from the map
      * @param key the key of the content
      */
      remove(key: number) {
      this.contents[key] = undefined;
      }
      /**
      * clear all contents in the map
      */
      clear() {
      this.contents = {};
      }
      /**
      * get the content in the map with key
      * @param key the key of the content
      */
      find(key: number): T {
      return this.contents[key];
      }
      /**
      * map
      * @param callback callback function called for every content
      */
      map(callback: (val?: T, key?: number) => void) {
      for (let key in this.contents) {
          if (!!this.contents[key]) callback(this.contents[key], parseInt(key));
      }
      }
  }

  export function time2Str(timeMs: number, fix: number = 2): string {
    let numStr, unitStr;
    if (timeMs < 60 * 1000) {
      numStr = (timeMs / 1000).toString()
      unitStr = "s"
    } else {
      numStr = (timeMs / 60 / 1000).toString()
      unitStr = "min"
    }

    let pointPos = numStr.search(/\./)
    if (pointPos >= 0) {
      numStr = numStr.substring(0, pointPos + fix + 1)
    }

    return numStr + unitStr
  }

  export function instance2PlainShallow(instance: any) {
    let plain: any = {}

    for (const key in instance) {
        if (instance.hasOwnProperty(key)) {
          plain[key] = instance[key]
        }
    }

    return plain
  }
  export function instance2PlainWithoutFuncDeep(instance: any) {
    let plain: any = {}

    for (const key in instance) {
        if (instance.hasOwnProperty(key)) {
          if (typeof instance[key] === "function") {
            continue
          } else if (typeof instance[key] === "object") {
            plain[key] = instance2PlainWithoutFuncDeep(instance[key])
          } else {
            plain[key] = instance[key]
          }
        }
    }

    return plain
  }
  export function copyProps<T>(target: T, source: Partial<T>) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        target[key] = source[key]
      }
    }
  }

  export function aLessThanB(a_uint: number, b_uint: number, uint_size: number) {
    console.assert(a_uint >= 0 && b_uint >= 0);
    a_uint = a_uint % uint_size;
    b_uint = b_uint % uint_size;
    if (b_uint == a_uint) {
      return false;
    }
    if (b_uint > a_uint) {
      return b_uint - a_uint < a_uint + uint_size - b_uint;
    }
    return a_uint - b_uint > b_uint + uint_size - a_uint;
  }

  export function generateHashCode(str: string): number {
    let hash = 0, i, chr;
    if (str.length === 0) return hash;
    for (i = 0; i < str.length; i++) {
        chr   = str.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }

  export function str2Color(str: string): number[] {
    // use hex string inside str if possible
    const retrievedHexes = str.toLowerCase().match(/#([0-9a-f]){6}/)
    if (retrievedHexes.length != 0) {
      const hex = retrievedHexes[0]
      return [[1, 3], [3, 5], [5, 7]].map((val) => parseInt(hex.substring(val[0], val[1]), 16))
    }

    // use hash
    const hash = softrobot.util.generateHashCode(str);
    const color = [(hash & 0x00ff0000) >> 16, (hash & 0x0000ff00) >> 8, (hash & 0x000000ff)]
    return color
  }
}
