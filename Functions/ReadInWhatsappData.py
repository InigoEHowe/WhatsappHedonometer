import pandas as pd
import re

" Functions here bar the FindTotalTime were taken from https://towardsdatascience.com/build-your-own-whatsapp-chat-analyzer-9590acca9014"

def startsWithDateTime(s):
    pattern = '^([0-2][0-9]|(3)[0-1])(\/)(((0)[0-9])|((1)[0-2]))(\/)(\d{2}|\d{4}), ([0-9][0-9]):([0-9][0-9]) -'
    result = re.match(pattern, s)
    if result:
        return True
    return False

def startsWithAuthor(s):
    patterns = [
        '([\w]+):',                        # First Name
        '([\w]+[\s]+[\w]+):',              # First Name + Last Name
        '([\w]+[\s]+[\w]+[\s]+[\w]+):',    # First Name + Middle Name + Last Name
    ]
    pattern = '^' + '|'.join(patterns)
    result = re.match(pattern, s)
    if result:
        return True
    return False

def getDataPoint(line):
    # line = d/m/y, h:m - User: Message
    splitLine = line.split(' - ') # splitLine = [d/m/y, h:m, Message]
    dateTime = splitLine[0] # dateTime = d/m/y, h:m'
    date, time = dateTime.split(', ') # date = d/m/y'; time = 'h:m'
    message = ' '.join(splitLine[1:]) # message = 'User: Message'
    
    if startsWithAuthor(message): 
        splitMessage = message.split(': ') # splitMessage = [User, Message]
        author = splitMessage[0] # author = User
        message = ' '.join(splitMessage[1:]) # message = Message
    else:
        author = None
    return date, time, author, message

def MakeDataFrame(whatsapp_data):
    parsedData = [] # List to keep track of data so it can be used by a Pandas dataframe
    with open(whatsapp_data, encoding="utf-8") as fp:
        fp.readline() # Skipping first line of the file (usually contains information about end-to-end encryption)
            
        messageBuffer = [] # Buffer to capture intermediate output for multi-line messages
        date, time, author = None, None, None # Intermediate variables to keep track of the current message being processed
        
        while True:
            line = fp.readline() 
            if not line: # Stop reading further if end of file has been reached
                break
            line = line.strip() # Guarding against erroneous leading and trailing whitespaces
            if startsWithDateTime(line): # If a line starts with a Date Time pattern, then this indicates the beginning of a new message
                if len(messageBuffer) > 0: # Check if the message buffer contains characters from previous iterations
                    parsedData.append([date, time, author, ' '.join(messageBuffer)]) # Save the tokens from the previous message in parsedData
                messageBuffer.clear() # Clear the message buffer so that it can be used for the next message
                date, time, author, message = getDataPoint(line) # Identify and extract tokens from the line
                messageBuffer.append(message) # Append message to buffer
            else:
                messageBuffer.append(line) # If a line doesn't start with a Date Time pattern, then it is part of a multi-line message. So, just append to buffer
    df = pd.DataFrame(parsedData, columns=['Date', 'Time', 'Author', 'Message'])
    
    # turn how media messages are labelled
    df['Message'] = df['Message'].replace(to_replace='<Media omitted>',value='image')    
    return df

def FindTotalTime(df):
    # Turn the types to Datetime
    df['Date'] =  pd.to_datetime(df['Date'], format='%d/%m/%Y')
    df['Time'] =  pd.to_datetime(df['Time'], format='%H:%M')
    
    # Find the number of days since the first message was sent 
    df['TotalTime'] = (df['Date'] - df['Date'][0]).dt.days
    return df

def ReadInWhatsappData(whatsapp_data):
    Data = MakeDataFrame(whatsapp_data)
    Data = FindTotalTime(Data)
    return Data