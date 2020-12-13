import seaborn as sns
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
    
    # Plot for the length of messages sent    
    fig, ax = plt.subplots()
    sns.lineplot(data=Data_me, x="Date", y="Average Message Length",marker='o', ax=ax, label=your_name)
    sns.lineplot(data=Data_them, x="Date", y="Average Message Length",marker='o', ax=ax, label= their_name)
    ax.set(xlabel="Date", ylabel="Average Message Length")
    return

def PlotWords(Data_me,Data_them,Words_used_me,Words_used_them,their_name,your_name,word):
    # Plot for the number of times a word was sent per message per period
    fig, ax = plt.subplots()
    word_me   = Words_used_me[word]/(Data_me['Number Sent']+0.0001)
    word_them = Words_used_them[word]/(Data_them['Number Sent']+0.0001)
    sns.lineplot(x=Words_used_me["Date"], y=word_me,marker='o', ax=ax, label=your_name)
    sns.lineplot(x=Words_used_them["Date"], y=word_them,marker='o', ax=ax, label= their_name)
    ax.set(xlabel="Date", ylabel="Times "+word+" was Said Per Message")
    
    return

def Plotting(Data_me,Data_them,Words_used_me,Words_used_them,their_name,your_name,words,generate_additional_plots):
    PlotHappiness(Data_me,Data_them,their_name,your_name)
    if generate_additional_plots == 1:
        PlotOthers(Data_me,Data_them,their_name,your_name)
    if words != []: # Check there are words in the list
        for word in words:
            PlotWords(Data_me,Data_them,Words_used_me,Words_used_them,their_name,your_name,word)
    return
