## WhatsappHedonometer
Generate plots of average word happiness vs date for a WhatsApp chat between two people. Additional plots of number and length of messages can be produced. Wordclouds coloured by happiness for the most commonly used words by each person and the amount one person uses a word more than the other are also generated. 

## ABOUT
This gives a similar plot to https://hedonometer.org/timeseries/en_all/ going to this site will give a better description of the method used to generate the happinesss data. This code will take in an exported Whatsapp chat text file. The method to export whatsapp data can be found herehttps://www.youtube.com/watch?v=-Ald352nhao please export it without media.

# NOTICE: WHEN TOU EXPORT YOUR WHATSAPP DATA IT IS NO LONGER ENCRYPTED. NEVER UPLOAD OR SHARE THIS DATA SOMEWHERE YOU DO NOT TRUST. 

# HOW TO RUN
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

## REQUIRMENTS
- pandas 
- wordcloud 
- matplotlib
- seaborn
- re
- datetime
- tqdm 
- math 
- statistics 
- numpy

# LIMITATIONS AND FURTHER REQUIRMENTS
- This was built for taking in Whatsapp data with the day/month/year 24 hour format and will not handle other formats.
- Images are turned into the message media omitted when exported, to stop these words dominating I turned this into the word image. 
- The words processed are only the words conatined in the Hedonometer.csv, if you would like other words included you can add them to the Hedonometer.csv file.I
- If you want to do the analysis for a different language you can download other Hedonometer dictonaries from the https://hedonometer.org/timeseries/en_all/  website.
 
 # FINALLY
 This is just meant to be for fun and if you are unhappy in any way I really hope that things get better. Please feel free to get in touch and let me know about any problems or ideas you may have via my twitter @InigoEHowe
