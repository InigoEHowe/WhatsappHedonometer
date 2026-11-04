import seaborn as sns
from wordcloud import WordCloud
import matplotlib.pylab as plt

def PlotHappiness(Data_me,Data_them,their_name,your_name):
    # Set styles for plots
    sns.set_style("ticks")
    sns.set_context("talk")
    
    # Take out times when we sent no messages
    Data_me = Data_me.drop(Data_me[Data_me['Message Happiness']==0].index)
    Data_them = Data_them.drop(Data_them[Data_them['Message Happiness']==0].index)
    
    fig, ax = plt.subplots()
    sns.lineplot(data=Data_me, x="Date", y="Message Happiness",marker='o', ax=ax, label=your_name)
    sns.lineplot(data=Data_them, x="Date", y="Message Happiness",marker='o', ax=ax, label= their_name)
    ax.set(xlabel="Date", ylabel="Average Happiness")
    fig.autofmt_xdate()
    return

def PlotOthers(Data_me,Data_them,their_name,your_name):
    # Set styles for plots
    sns.set_style("ticks")
    sns.set_context("talk")
    
    # Plot for the number of messages sent    
    fig, ax = plt.subplots()
    sns.lineplot(data=Data_me, x="Date", y="Number Sent",marker='o', ax=ax, label=your_name)
    sns.lineplot(data=Data_them, x="Date", y="Number Sent",marker='o', ax=ax, label= their_name)
    ax.set(xlabel="Date", ylabel="Messages Sent")
    fig.autofmt_xdate()
    
    # Plot for the length of messages sent    
    fig, ax = plt.subplots()
    sns.lineplot(data=Data_me, x="Date", y="Average Message Length",marker='o', ax=ax, label=your_name)
    sns.lineplot(data=Data_them, x="Date", y="Average Message Length",marker='o', ax=ax, label= their_name)
    ax.set(xlabel="Date", ylabel="Average Message Length")
    fig.autofmt_xdate()
    return

def PlotWords(Data_me,Data_them,Words_used_me,Words_used_them,their_name,your_name,word):
    # Plot for the number of times a word was sent per message per period
    fig, ax = plt.subplots()
    word_me   = Words_used_me[word]/(Data_me['Number Sent']+0.0001)
    word_them = Words_used_them[word]/(Data_them['Number Sent']+0.0001)
    sns.lineplot(x=Words_used_me["Date"], y=word_me,marker='o', ax=ax, label=your_name)
    sns.lineplot(x=Words_used_them["Date"], y=word_them,marker='o', ax=ax, label= their_name)
    ax.set(xlabel="Date", ylabel="Times "+word+" was Said Per Message")
    fig.autofmt_xdate()
    
    return

def Plotting(Data_me,Data_them,Words_used_me,Words_used_them,their_name,your_name,words,generate_additional_plots):
    PlotHappiness(Data_me,Data_them,their_name,your_name)
    if generate_additional_plots == 1:
        PlotOthers(Data_me,Data_them,their_name,your_name)
    if words != []: # Check there are words in the list
        for word in words:
            PlotWords(Data_me,Data_them,Words_used_me,Words_used_them,their_name,your_name,word)
    return

def WordCloudFromDic(dic,title,word_happiness):
    # This takes in a dict of frequencies of use of various words and plots a word cloud based on them
    dic = {word: count for word, count in dic.items() if count > 0}
    if not dic: # The wordcloud can't be drawn with no words in it
        print(' Warning: no words to show for \''+title+'\'')
        return
    scores = dict(zip(word_happiness['Word'], word_happiness['Happiness Score']))

    def HappinessColorFunc(word, font_size, position, orientation, random_state=None, **kwargs):
        # Colour the word depending on the happiness. Green is more happy and red is less happy
        word_happiness_score = scores.get(word, 5)
        r = int(255.0*(10.0-word_happiness_score)/10.0)
        g = int(255.0*(word_happiness_score)/10.0)
        return "rgb({}, {}, 0)".format(r, g)

    wordcloud = WordCloud(width = 800, height = 800, 
                background_color ='white', 
                min_font_size = 10)
    wordcloud.generate_from_frequencies(frequencies=dic)
    # Recolour based on how happy the word is
    wordcloud.recolor(color_func = HappinessColorFunc)
    
    # Generate the plot
    plt.figure(title)
    plt.imshow(wordcloud, interpolation="bilinear")
    plt.axis("off")
    plt.title(title)
    return

def WordClouds(Words_used_me,Words_used_them,word_happiness,your_name,their_name):
    # Number of times each person used each word over the whole chat
    word_count_me   = Words_used_me.drop(columns='Date').sum(axis=0)
    word_count_them = Words_used_them.drop(columns='Date').sum(axis=0)

    # Words each person uses most
    WordCloudFromDic(word_count_me.to_dict(),'Words ' + your_name + ' used most',word_happiness)
    WordCloudFromDic(word_count_them.to_dict(),'Words ' + their_name + ' used most',word_happiness)

    # Words each person uses more than the other
    WordCloudFromDic((word_count_me - word_count_them).to_dict(),'Words ' + your_name + ' uses more',word_happiness)
    WordCloudFromDic((word_count_them - word_count_me).to_dict(),'Words ' + their_name + ' uses more',word_happiness)
    return
