## WhatsappHedonometer
Generate plots of average word happiness vs date for a WhatsApp chat between two people. Additional plots of number and length of messages can be produced. Wordclouds coloured by happiness for the most commonly used words by each person and the amount one person uses a word more than the other are also generated. 

## ABOUT
This gives a similar plot to https://hedonometer.org/timeseries/en_all/ going to this site will give a better description of the method used to generate the happinesss data. This code will take in an exported Whatsapp chat text file. The method to export whatsapp data can be found herehttps://www.youtube.com/watch?v=-Ald352nhao please export it without media.

# NOTICE: WHEN TOU EXPORT YOUR WHATSAPP DATA IT IS NO LONGER ENCRYPTED. NEVER UPLOAD OR SHARE THIS DATA SOMEWHERE YOU DO NOT TRUST. 

# WEB VERSION (NEW!)
The `web/` folder is a version that runs entirely in your browser: drop in your exported chat (the .txt, or the .zip an iPhone gives you) and get interactive charts. Your chat is read on your own device and never uploaded. It works for group chats too.

It adds, on top of the hedonometer:
- An AI mood reader: a sentiment model trained on tweets (twitter-roberta-base-sentiment) that runs inside the browser and understands negation, slang and emoji. The model (about 125 MB) is downloaded once from Hugging Face; your messages stay on your computer.
- A Hall of Fame of awards (Speed Demon, Night Owl, Double Texter, Left on Read, Emoji Monarch...)
- Conversation dynamics: who starts conversations, who gets the last word, reply times, streaks, the longest silence and a heatmap of when you talk
- Top emoji per person, a Laugh-o-meter and emoji use over time
- Happiness coloured word clouds, a word tracker and the happiest and saddest messages

To run it locally, serve the folder (opening index.html directly won't work, browsers block the module scripts):
```
python -m http.server 8765 --directory web
```
then open http://localhost:8765. It can also be hosted for free with GitHub Pages.

# HOW TO RUN (PYTHON VERSION)
1. Change the input parameters in the WhatsappHedonometer.py file
2. Run WhatsappHedonometer.py

## INPUT 
Prior to running the code go into the WhatsappHedonometer.py file and change the input parameters. The code will not run unless you have changed the following inputs
1. whatsapp_data
2. their_name
3. your_name

## OUTPUT
The following plots are generated.
1. A line plot for the number of messages against the date for each user (optional)
2. A line plot for the average length of messages sent against the date for each user (optional)
3. A Hedonometer line plot showing the average happiness of words used in the time period against the date. 
4. A series line plots for each user of how often a word is used in a given period. With the set of words specified in the input.
5. A Wordcloud for each user showing the most common words used, colured according to how happy each word is.
6. A Wordcloud for how many more times a word is used compared to the other user for each user, coloured  according to how happy each word is. 

## REQUIREMENTS
Python 3.10+ with the packages in requirements.txt:
```
pip install -r requirements.txt
```

# LIMITATIONS AND FURTHER REQUIRMENTS
- Works with chats exported from Android or iPhone, in 12 or 24 hour time. Day/month order is detected automatically; set day_first in WhatsappHedonometer.py if your chat only has dates that could be either.
- Images are turned into the message media omitted when exported, to stop these words dominating I turned this into the word image. 
- The words processed are only the words conatined in the Hedonometer.csv, if you would like other words included you can add them to the Hedonometer.csv file.I
- If you want to do the analysis for a different language you can download other Hedonometer dictonaries from the https://hedonometer.org/timeseries/en_all/  website.
 
 # FINALLY
 This is just meant to be for fun and if you are unhappy in any way I really hope that things get better. Please feel free to get in touch and let me know about any problems or ideas you may have via my twitter @InigoEHowe
