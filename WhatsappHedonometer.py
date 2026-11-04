import pandas as pd
import matplotlib.pylab as plt

# This uses data from https://hedonometer.org/about.html to extract statisatics from a 2 person Whatsapp chat
# Plots are generated taking an average from a number of days indicated in the input parameters below
# Please refer to the README file for infomation on how the program functions.

# INPUT PARAMETERS
happiness_data = 'Hedonometer.csv' # Here replace Hedonometer.csv with the filename of the data from https://hedonometer.org/about.html
whatsapp_data = 'whatsApp.txt' # filepath to the whatsapp chat data
their_name = 'Their Name' # Their name as appears in the Whatsapp chat
your_name = 'Your Name' # Your name as appears in the Whatsapp chat
number_of_days = 7 # The time period over which the data is compared. i.e. if you wanted to see how things change day by day change this to 1.
words = ['love'] # Plots will be generated for the use of the words indicated here, put as [] if you do not wish to generate this plot
delh = 1 #See OmmitBoringWords (A reasonable rnge of this is 0-2)
generate_additional_plots = True # generate plots for the number of messages sent and the average message length over time
day_first = None # None works out if dates are day/month or month/day. Set True (UK style) or False (US style) to force it


def OmmitBoringWords(word_happiness,delh):
    # To avoid common connecting words such as is, it or the from dominating remove
    # all words that have a happiness that falls between h-delh<h<h+delh to remove
    # neutral words centred around 5. This is set to 1 as a default
    # This is similar to the method laid out in the following paper
    #'1. Dodds, P., Harris, K., Kloumann, I., Bliss, C. and Danforth, C., 2020.
    #Temporal Patterns Of Happiness And Information In A Global Social Network: Hedonometrics And Twitter.'

    word_happiness = word_happiness.drop(word_happiness[(word_happiness['Happiness Score']<=5+delh) &
                                                (word_happiness['Happiness Score']>=5-delh)].index)
    return word_happiness

## Read in the happiness of each word. keep_default_na stops words like 'na' and 'null' being read as missing
word_happiness = pd.read_csv(happiness_data, keep_default_na=False)
word_happiness['Word'] = word_happiness['Word'].astype(str).str.lower()
word_happiness = word_happiness.drop_duplicates('Word').reset_index(drop=True)

## Ommit neutral words
word_happiness = OmmitBoringWords(word_happiness,delh)

# Import the functions from the subfiles
from Functions.ReadInWhatsappData import ReadInWhatsappData
from Functions.Preprocessing import Preprocess
from Functions.Plotting import Plotting, WordClouds

## Construct a pandas Dataframe holding the Whatsapp data
# The following stucture is used: DateTime, Date (Datetime), Time, Author (string), Message (string), TotalTime (days since the first message)
Data = ReadInWhatsappData(whatsapp_data, day_first)

## PREPROCESSING
# The following program extracts two pieces of infomation, Data_x shows for each period all the messages sent by user x in
# one string as well as the number sent the period, the average length of messages sent in the period, the average happiness of
# words in the period that exist in the word_happiness variable and the Date in the middle of the given period.
Data_me,Data_them,Words_used_me,Words_used_them = Preprocess(Data,word_happiness,number_of_days,their_name,your_name)

## PLOTTING
# This will generate plots against the Date sent
# The following checks that any words being examined are in the happiness list
for word in words:
    if not (word_happiness['Word'].eq(word)).any():
        print(' Warning: \''+word+'\' is not in the happiness list, consider adding it yourself')
words = [word for word in words if (word_happiness['Word'].eq(word)).any()]
Plotting(Data_me,Data_them,Words_used_me,Words_used_them,their_name,your_name,words,generate_additional_plots)

# Word Clouds
WordClouds(Words_used_me,Words_used_them,word_happiness,your_name,their_name)

plt.show()
