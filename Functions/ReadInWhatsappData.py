import pandas as pd
import re

# Reads an exported WhatsApp chat into a DataFrame. Handles the formats WhatsApp currently produces:
#   Android: 04/11/2026, 14:32 - Name: Message       (or 11/4/26, 2:32 PM - Name: Message)
#   iPhone:  [04/11/2026, 14:32:05] Name: Message    (or [11/4/26, 2:32:05 PM] Name: Message)
# Day/month order is detected automatically from the dates in the file.

# Start of a new message: optional '[', date, time, optional AM/PM, then ']' or ' -'
LINE_START = re.compile(
    r'^\[?(?P<d1>\d{1,2})[/.\-](?P<d2>\d{1,2})[/.\-](?P<year>\d{2,4}),?\s+'
    r'(?P<time>\d{1,2}[:.]\d{2}(?:[:.]\d{2})?)\s?(?P<ampm>[AaPp]\.?\s?[Mm]\.?)?'
    r'(?:\]\s?|\s-\s)(?P<rest>.*)$')

# Invisible direction marks and odd spaces that newer exports scatter through the text
INVISIBLE = re.compile('[‎‏‪-‮⁦-⁩﻿]')

# Media placeholders are all turned into the word 'image' (as before) so they don't dominate the word counts
MEDIA = re.compile(r'^(<Media omitted>|(image|video|audio|sticker|GIF|document|Contact card) omitted|<attached: .*>)$',
                   re.IGNORECASE)

# WhatsApp system notices that aren't real messages
SYSTEM = ('Messages and calls are end-to-end encrypted', 'This message was deleted', 'You deleted this message',
          'Missed voice call', 'Missed video call', 'Waiting for this message')

def CleanLine(line):
    line = INVISIBLE.sub('', line)
    return line.replace(' ', ' ').replace(' ', ' ').strip()

def ParseLines(whatsapp_data):
    # Collect [d1, d2, year, time, ampm, author, message] for every message, joining multi-line messages
    parsedData = []
    with open(whatsapp_data, encoding="utf-8-sig") as fp:
        for line in fp:
            line = CleanLine(line)
            match = LINE_START.match(line)
            if match:
                rest = match.group('rest')
                if ': ' in rest:
                    author, message = rest.split(': ', 1)
                else:
                    author, message = None, rest # e.g. 'Alice added Bob'
                parsedData.append([match.group('d1'), match.group('d2'), match.group('year'),
                                   match.group('time'), match.group('ampm'), author, message])
            elif parsedData and line:
                parsedData[-1][-1] += ' ' + line # Continuation of a multi-line message
    if not parsedData:
        raise ValueError('No messages found in ' + whatsapp_data + '. Is this an exported WhatsApp chat (.txt)?')
    return pd.DataFrame(parsedData, columns=['d1', 'd2', 'Year', 'Time', 'AmPm', 'Author', 'Message'])

def MakeDataFrame(whatsapp_data, day_first=None):
    df = ParseLines(whatsapp_data)

    # Work out if dates are day/month or month/day. If no date settles it, assume day/month
    d1, d2 = df['d1'].astype(int), df['d2'].astype(int)
    if day_first is None:
        day_first = not ((d2 > 12).any() and not (d1 > 12).any())
    day, month = (d1, d2) if day_first else (d2, d1)

    year = df['Year'].astype(int)
    year = year.where(year >= 100, year + 2000)
    time = df['Time'].str.replace('.', ':', regex=False)
    time = time.where(time.str.count(':') == 2, time + ':00')
    ampm = df['AmPm'].fillna('').str.replace('.', '', regex=False).str.replace(' ', '').str.upper()
    has_ampm = ampm != ''

    stamp = (year.astype(str) + '-' + month.astype(str) + '-' + day.astype(str) + ' ' + time)
    DateTime = pd.Series(pd.NaT, index=df.index, dtype='datetime64[ns]')
    DateTime[~has_ampm] = pd.to_datetime(stamp[~has_ampm], format='%Y-%m-%d %H:%M:%S')
    DateTime[has_ampm] = pd.to_datetime(stamp[has_ampm] + ' ' + ampm[has_ampm], format='%Y-%m-%d %I:%M:%S %p')

    df = pd.DataFrame({'DateTime': DateTime, 'Author': df['Author'], 'Message': df['Message'].str.strip()})

    # Drop system notices and turn media placeholders into 'image'
    df = df[df['Author'].notna() & ~df['Message'].str.startswith(SYSTEM)]
    df['Message'] = df['Message'].str.replace('<This message was edited>', '', regex=False)
    df.loc[df['Message'].str.match(MEDIA), 'Message'] = 'image'
    return df.reset_index(drop=True)

def FindTotalTime(df):
    df['Date'] = df['DateTime'].dt.normalize()
    df['Time'] = df['DateTime'].dt.time

    # Find the number of days since the first message was sent
    df['TotalTime'] = (df['Date'] - df['Date'].min()).dt.days
    return df

def ReadInWhatsappData(whatsapp_data, day_first=None):
    Data = MakeDataFrame(whatsapp_data, day_first)
    Data = FindTotalTime(Data)
    return Data
