import pandas as pd
from wordcloud import WordCloud, STOPWORDS
import matplotlib.pylab as plt

# This uses data from https://hedonometer.org/about.html to extract statisatics from a 2 person Whatsapp chat
# Plots are generated taking an average from a number of days indicated in the input parameters below
# Please refer to the README file for infomation on how the program functions.

# INPUT PARAMETERS
word_happiness = pd.read_csv (r'Hedonometer.csv') # Here replace Hedonometer.csv with the filename of the data from https://hedonometer.org/about.html
whatsapp_data = 'whatsApp.txt' # filepath to the whatsapp chat data
their_name = 'Their Name' # Their name as appears in the Whatsapp chat
your_name = 'Your Name' # Your name as appears in the Whatsapp chat
number_of_days = 7 # The time period over which the data is compared. i.e. if you wanted to see how things change day by day change this to 1. 
words = ['love'] # Plots will be generated for the use of the words indicated here, put as [] if you do not wish to generate this plot
delh = 1 #See OmmitBoringWords (A reasonable rnge of this is 0-2)
generate_additional_plots = True # generate plots for the number of messages sent and the average message length over time


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

## Ommit neutral words
word_happiness = OmmitBoringWords(word_happiness,delh)

# Import the functions from the subfiles
from Functions.ReadInWhatsappData import ReadInWhatsappData
from Functions.Preprocessing import Preprocess
from Functions.Plotting import Plotting

## Construct a pandas Dataframe holding the Whatsapp data
# The following stucture is used: Date (Datetime), Time (Datetime), Author (string), Message (string), TotalTime (numpy.int64)
Data = ReadInWhatsappData(whatsapp_data)

## PREPROCESSING
# The following program extracts two pieces of infomation, Data_x shows for each period all the messages sent by user x in 
# one string as well as the number sent the period, the average length of messages sent in the period, the average happiness of
# words in the period that exist in the word_happiness variable and the Date in the middle of the given period. 
Data_me,Data_them,Words_used_me,Words_used_them = Preprocess(Data,word_happiness,number_of_days,their_name,your_name)

## PLOTTING
# This will generate plots against the Date sent
# The following checks that any words being examined are 
for word in words:
    if not (word_happiness['Word'].eq(word)).any():
        print(' Warning: \''+word+'\' is not in the happiness list, consider adding it yourself')
        words.remove(word)
Plotting(Data_me,Data_them,Words_used_me,Words_used_them,their_name,your_name,words,generate_additional_plots)

# Word Clouds
# I was unable to put these in a seperate file as the colouring of the words requires the global word_happiness
# parameter and I could not figure out how to do that in a seperate file.

def HappinessColorFunc(word, font_size, position,orientation,random_state=None, **kwargs):
    # find how happy the given word is
    word_happiness_score = word_happiness.loc[(word_happiness['Word'] == word).idxmax(),'Happiness Score']
    
    # Colour the word depending on the happiness. Green is more happy and red is less happy
    r = int(255.0*(10.0-word_happiness_score)/10.0)
    g = int(255.0*(word_happiness_score)/10.0)

    return "rgb({}, {}, 0)".format(r, g)

def GenerateWordCloud(Words_used):
    # Make a varibale containing all the words used tobe fed into the wordcloud
    word_count = pd.DataFrame(Words_used.sum(axis=0))
    word_count['words'] = word_count.index
    
    # Make dictonary of frequencies to read into the wordcloud
    dic = {}
    for a, x in word_count.values:
        dic[x] = a

    WordCloudFromDic(dic)
    return

def WordCloudFromDic(dic):
    # This takes in a dict of frequencies of use of various words and plots a word cloud based on them
    # This will exclude common connecting words which can be shown by looking into the STOPWORDS variable. 
    wordcloud = WordCloud(width = 800, height = 800, 
                background_color ='white', 
                stopwords = STOPWORDS,
                min_font_size = 10)
    wordcloud.generate_from_frequencies(frequencies=dic)
    # Recolour based on how happy the word is
    wordcloud.recolor(color_func = HappinessColorFunc)
    
    # Generate the plot
    plt.figure()
    plt.imshow(wordcloud, interpolation="bilinear")
    plt.axis("off")
    plt.show()
    return

def GenerateWordCloudMoreUsedWords(Words_used_me,Words_used_them):
    # Make a varibale containing the number of times we use each word
    word_count_me = pd.DataFrame(Words_used_me.sum(axis=0))
    word_count_me['words'] = word_count_me.index
    word_count_them = pd.DataFrame(Words_used_them.sum(axis=0))
    word_count_them['words'] = word_count_them.index
    
    # Find the words you said more
    word_count_diff_me = pd.DataFrame((word_count_me[0] - word_count_them[0]))
    word_count_diff_me['words'] = word_count_diff_me.index
    word_count_diff_me = word_count_diff_me[word_count_diff_me[0]>0]
    
    # Find the words they said more
    word_count_diff_them = pd.DataFrame((word_count_them[0] - word_count_me[0]))
    word_count_diff_them['words'] = word_count_diff_them.index
    word_count_diff_them = word_count_diff_them[word_count_diff_them[0]>0]
    
    # Make dictonary of frequencies to read into the wordcloud
    dic_me = {}
    for a, x in word_count_diff_me.values:
        dic_me[x] = a
        
    dic_them = {}
    for a, x in word_count_diff_them.values:
        dic_them[x] = a
        
    WordCloudFromDic(dic_me)
    WordCloudFromDic(dic_them)
    return

GenerateWordCloud(Words_used_me)
GenerateWordCloud(Words_used_them)
GenerateWordCloudMoreUsedWords(Words_used_me,Words_used_them)