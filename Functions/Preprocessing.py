import pandas as pd
import re
from collections import Counter

def SplitWords(message):
    # This will remove .\#% and others (keeping words like can't and self-quarantine), put the words in
    # lowercase and split into a list of words
    string = re.sub(r'[^\w\'-]', ' ', str(message).replace('’', "'")).lower()
    return [word.strip("'-") for word in string.split() if word.strip("'-")]

def CheckNames(df, their_name, your_name):
    # Give a helpful error if the names don't match anyone in the chat
    authors = df['Author'].value_counts()
    for name in (their_name, your_name):
        if name not in authors.index:
            raise ValueError('\'' + name + '\' does not appear in the chat. The people in this chat are:\n  '
                             + '\n  '.join(authors.index[:10]) + '\nCopy the names exactly into WhatsappHedonometer.py')

def GroupByPeriod(df, number_of_days, NumberOfPeriods):
    # For each period: all the messages sent in one string, the number sent and the average words per message
    df = df.assign(Period=df['TotalTime'] // number_of_days,
                   Length=df['Message'].map(lambda m: len(SplitWords(m))))
    grouped = df.groupby('Period')
    df_period = pd.DataFrame({'Message': grouped['Message'].agg(' '.join),
                              'Number Sent': grouped.size(),
                              'Average Message Length': grouped['Length'].mean()})

    # Periods where nothing was sent still need a row
    df_period = df_period.reindex(range(NumberOfPeriods))
    df_period['Message'] = df_period['Message'].fillna('')
    df_period = df_period.fillna(0)
    df_period.index.name = 'Period'
    return df_period.reset_index()

def MessageWordsHappiness(df, word_happiness, number_of_days, start_date):
    # return a measure of the happiness of the words in each period and a dataframe of which words are used
    scores = dict(zip(word_happiness['Word'], word_happiness['Happiness Score']))

    counts = []
    MessageHappiness = []
    for message in df['Message']:
        count = Counter(word for word in SplitWords(message) if word in scores)
        counts.append(count)
        # Average happiness of all scored words in the period. Periods with no scored words get 0 and aren't plotted
        total = sum(count.values())
        MessageHappiness.append(sum(scores[w]*n for w, n in count.items())/total if total else 0)

    df['Message Happiness'] = MessageHappiness

    # Number of times each word turns up in each period
    Words_used = pd.DataFrame(counts, columns=word_happiness['Word']).fillna(0).astype(int)

    # Convert the period col into dates, taking the middle of the period
    df['Date'] = start_date + pd.to_timedelta(df['Period']*number_of_days + 0.5*number_of_days, unit='D')
    Words_used['Date'] = df['Date']
    return df, Words_used

def Preprocess(Data, word_happiness, number_of_days, their_name, your_name):
    CheckNames(Data, their_name, your_name)
    NumberOfPeriods = Data['TotalTime'].max()//number_of_days + 1
    start_date = Data['Date'].min()

    Data_me   = GroupByPeriod(Data[Data['Author'] == your_name], number_of_days, NumberOfPeriods)
    Data_them = GroupByPeriod(Data[Data['Author'] == their_name], number_of_days, NumberOfPeriods)
    Data_me, Words_used_me     = MessageWordsHappiness(Data_me, word_happiness, number_of_days, start_date)
    Data_them, Words_used_them = MessageWordsHappiness(Data_them, word_happiness, number_of_days, start_date)
    return Data_me, Data_them, Words_used_me, Words_used_them
