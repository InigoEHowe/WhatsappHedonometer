import pandas as pd
import re
from datetime import datetime
from tqdm import tqdm
import math as maths
import statistics as stats
import numpy as np

def PreprocessInPeriod(NumberOfPeriods, number_of_days, df, df_period):
    
    # Preallocate 
    all_messages = ['blank']*(NumberOfPeriods) # Col which will hold every message sent in each period
    number_sent =  [0]*(NumberOfPeriods) # Col to hold the number of messages sent in that period
    avg_message_length = [0]*(NumberOfPeriods) # Col to hold the average message length sent in that period
    
    for period in range(NumberOfPeriods): # for a 1 week period
        # Extract sub dataframe of messages within the period
        df_temp   = df[(df['TotalTime'] >= number_of_days*period) & 
                             (df['TotalTime'] <= (number_of_days)*(period+1))]
        
        # Join all the messages in the period into one string
        joined_messages = ' '.join(df_temp['Message'].tolist())
        all_messages[period] = joined_messages
        
        # Find the number of messages sent in each period
        number_sent[period] = len(df_temp.index)
                    
        # Find the average number of words per message in the period
        message_length_temp = [0]
        for message in (df_temp['Message']):
            string = re.sub(r'[^\w]', ' ', str(message))
            string_split = string.split()
            message_length_temp.append(len(string_split))

        avg_message_length[period] = stats.mean(message_length_temp)
    
    # Add these varaibles into the dataframe
    df_period['Message'] = all_messages
    df_period['Number Sent'] = number_sent
    df_period['Average Message Length'] = avg_message_length
        
    return df_period

def GroupByPeriod(df, number_of_days,their_name,your_name):
    # Seperate the dataframes based on if it's me of the sending the message
    df_me   = df[df['Author'] == your_name]
    df_them = df[df['Author'] == their_name]
    
    # Group the messages into sets sent by each person over a 7 day window
    NumberOfPeriods = maths.floor(df['TotalTime'].max()/number_of_days)
    
    # set up dataframes that will take in the week by week data
    df_me_period   = pd.DataFrame(range(NumberOfPeriods))
    df_me_period = df_me_period.rename(columns={0:'Period'})
    df_them_period = pd.DataFrame(range(NumberOfPeriods))
    df_them_period = df_them_period.rename(columns={0:'Period'})
    
    # Form the dataframes with all the words sent in the period
    df_me_period   = PreprocessInPeriod(NumberOfPeriods, number_of_days, df_me, df_me_period)
    df_them_period = PreprocessInPeriod(NumberOfPeriods, number_of_days, df_them, df_them_period)
        
    return df_me_period, df_them_period

def MessageWordsHappiness(df,word_happiness,number_of_days,start_time):
    # return a measure of the happiness of the words in each week and a dataframe of which words are used
    # Make DataFrame for the number of times words are used in each period
    Words_used = pd.DataFrame(0, index=np.arange(len(df.index)), columns=word_happiness['Word'])
    
    MessageHappiness = []
    period = 0
    for message in tqdm(df['Message']):
        # preallocate
        count = 0 # number of words for which there is a happiness measure
        message_happiness = 0 # How happy thr message is
        # This will remove '.\#% and others
        string = re.sub(r'[^\w]', ' ', str(message))
        # Put all words into lowercase
        string = string.lower()
        # Split the string into a list of individual words
        string_split = string.split()
        # Loop over each word 
        for word in string_split:
            if  (word_happiness['Word'].eq(word)).any(): # Determine if the word is contained in the word_happiness data
                # Find the words happiness and add it to the total happiness of the message
                word_idx = (word_happiness['Word'] == word).idxmax()
                message_happiness = message_happiness+ word_happiness.loc[word_idx,'Happiness Score']
                # Keep count of the number of words we are counting the happiness for
                count = count + 1
                
                # Number of times each word turns up
                Words_used.loc[period,word] = Words_used.loc[period,word] + 1
        
        # In the case that no words which have a happiness score set the happiness to 0. These will not be plotted in the final plot
        if count > 0:
            message_happiness = message_happiness/count
        else:
            message_happiness = 0
            
        MessageHappiness.append(message_happiness)
        period = period + 1
        
    df['Message Happiness'] = MessageHappiness
    
    # Convert the period col into dates
    df['Date'] = pd.to_datetime(((df['Period']*number_of_days+0.5*number_of_days)*24*60*60+start_time),unit='s')# turn into datetime format
    Words_used['Date'] = df['Date']
    
    return df, Words_used


def  Preprocess(Data,word_happiness,number_of_days,their_name,your_name):
    Data_me, Data_them = GroupByPeriod(Data,number_of_days,their_name,your_name)
    Data_me, Words_used_me = MessageWordsHappiness(Data_me,word_happiness,number_of_days,datetime.timestamp(Data['Date'][0]))
    Data_them, Words_used_them = MessageWordsHappiness(Data_them,word_happiness,number_of_days,datetime.timestamp(Data['Date'][0]))
    return Data_me,Data_them,Words_used_me,Words_used_them