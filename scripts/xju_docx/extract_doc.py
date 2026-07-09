"""Minimal Word97 .doc text extractor (FIB -> Clx -> piece table)."""
import struct, sys
import olefile

def extract(path):
    ole = olefile.OleFileIO(path)
    wd = ole.openstream('WordDocument').read()
    flags = struct.unpack('<H', wd[0x000A:0x000C])[0]
    table_name = '1Table' if (flags & 0x0200) else '0Table'
    table = ole.openstream(table_name).read()
    fcClx, lcbClx = struct.unpack('<II', wd[0x01A2:0x01AA])
    clx = table[fcClx:fcClx + lcbClx]

    # walk Clx: skip Prc entries (0x01), find Pcdt (0x02)
    pos = 0
    while pos < len(clx):
        clxt = clx[pos]
        if clxt == 1:
            cb = struct.unpack('<H', clx[pos+1:pos+3])[0]
            pos += 3 + cb
        elif clxt == 2:
            lcb = struct.unpack('<I', clx[pos+1:pos+5])[0]
            plcpcd = clx[pos+5:pos+5+lcb]
            break
        else:
            raise ValueError(f'unexpected clxt {clxt} at {pos}')
    else:
        raise ValueError('no Pcdt found')

    n = (len(plcpcd) - 4) // 12
    cps = struct.unpack(f'<{n+1}I', plcpcd[:4*(n+1)])
    out = []
    for i in range(n):
        pcd = plcpcd[4*(n+1) + 8*i : 4*(n+1) + 8*(i+1)]
        fc = struct.unpack('<I', pcd[2:6])[0]
        ncp = cps[i+1] - cps[i]
        if fc & 0x40000000:  # compressed: cp1252-ish single byte
            start = (fc & 0x3FFFFFFF) >> 1
            raw = wd[start:start + ncp]
            out.append(raw.decode('cp1252', errors='replace'))
        else:
            start = fc & 0x3FFFFFFF
            raw = wd[start:start + 2*ncp]
            out.append(raw.decode('utf-16-le', errors='replace'))
    ole.close()
    return ''.join(out)

if __name__ == '__main__':
    text = extract(sys.argv[1])
    # normalize Word control chars: \r = para end, \x07 = cell/row end, \x0c = page break
    text = text.replace('\r', '\n').replace('\x07', ' | ').replace('\x0b', '\n')
    sys.stdout.write(text)
