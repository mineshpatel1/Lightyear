#! /usr/bin/env python
# LYF data integration function library

import sys, os, logging
import requests
import argparse
import httplib2
import tweepy
import re

from ConfigParser import ConfigParser	#	Used for reading the config file
from apiclient.discovery import build	# Builds Google API service
from oauth2client.service_account import ServiceAccountCredentials	# Google authenticator
from oauth2client import client, file, tools	# Functions for OAuth2
from datetime import date, timedelta, datetime	# Date time
from dateutil.parser import parse	# Date parser

global SCRIPT_DIR
SCRIPT_DIR = os.path.abspath(os.path.dirname(sys.argv[0]))
CONFIG = os.path.join(SCRIPT_DIR, 'config.ini')

# Set up log file
global LOG_FORMAT, LOG_FILE
LOG_FORMAT = '%(levelname)s: %(asctime)s [%(filename)s (%(funcName)s - Line %(lineno)s)]: %(message)s'
LOG_FILE = os.path.join(SCRIPT_DIR, 'logs', 'out.log')
logging.basicConfig(filename=LOG_FILE,level=logging.INFO, format=LOG_FORMAT, datefmt='%Y-%m-%d %H:%M:%S')

logging.getLogger().addHandler(logging.StreamHandler()) # Print to stderr

# Suppress sub module messages
logging.getLogger("requests").setLevel(logging.CRITICAL)
logging.getLogger("tweepy").setLevel(logging.CRITICAL)
logging.getLogger("discovery").setLevel(logging.CRITICAL)
logging.getLogger("googleapiclient").setLevel(logging.CRITICAL)
logging.getLogger("oauth2client").setLevel(logging.CRITICAL)

# Define modules in the package
__all__ = ["sql"]

# Class for youtube videos
class YT_Video():
	def __init__(self, id, name, publish_date, channel, views=0, likes=0, dislikes=0): # Initialiser
		self.id = id
		self.name = name
		self.publish_date = parse(publish_date)
		self.channel = channel
		self.views = int(views)
		self.likes = int(likes)
		self.dislikes = int(dislikes)

# Class for MailChimp subscriber lists
class MC_List():
	def __init__(self, id, name, created_date, subscribe_url='', total_members=0, \
		total_unsubscribed=0, total_cleaned=0, total_campaigns=0, open_rate=0, click_rate=0, \
		avg_sub_rate=0, last_campaign=None, last_subscriber=None): # Initialiser
		self.list_id = id
		self.name = name
		self.created_date = parse(created_date)
		self.subscribe_url = subscribe_url
		self.total_members = int(total_members)
		self.total_unsubscribed = int(total_unsubscribed)
		self.total_cleaned = int(total_cleaned)
		self.total_campaigns = int(total_campaigns)
		self.open_rate = float(open_rate)
		self.avg_sub_rate = float(avg_sub_rate)
		self.last_campaign = parse(last_campaign)
		self.last_subscriber = parse(last_subscriber)

class MC_Campaign():
	def __init__(self, id, name, subject, created, emails_sent, open_rate, click_rate, subscriber_clicks, clicks, opens, \
	 	unique_opens):
		self.campaign_id = id
		self.name = name
		self.subject = subject
		self.emails_sent = emails_sent
		self.created_date = created
		self.emails_sent = emails_sent
		self.open_rate = open_rate
		self.click_rate = click_rate
		self.subscriber_clicks = subscriber_clicks
		self.clicks = clicks
		self.opens = opens

# Gets a configuration value from a section and parameter name
def get_config(section, param):
	parser = ConfigParser()
	parser.read(CONFIG)
	out = parser.get(section, param).replace('\\','')
	return out

# Sets a configuration value in a section
def write_config(section, param, value):
	parser = ConfigParser()
	parser = ConfigParser()
	parser.read(CONFIG)
	parser.set(section, param, value)
	cfgfile = open(CONFIG,'w')
	parser.write(cfgfile)
	cfgfile.close()

# Gets an authenticated service for a given Google API and versioin
def google_api(api, version, scopes):
	key_file = os.path.join(SCRIPT_DIR, get_config('GOOGLE_ANALYTICS','Key_File'))
	credentials = ServiceAccountCredentials.from_json_keyfile_name(key_file, scopes=scopes)
	http = credentials.authorize(httplib2.Http())
	service = build(api, version, http=http) # Build the service object.
	return service

# Connects to Twitter API and returns the service object
def twitter_api():
	consumer_key = get_config('TWITTER', 'Consumer_Key')
	consumer_secret = get_config('TWITTER', 'Consumer_Secret')
	access_token = get_config('TWITTER', 'Access_Token')
	access_token_secret = get_config('TWITTER', 'Access_Token_Secret')

	auth = tweepy.OAuthHandler(consumer_key, consumer_secret)
	auth.set_access_token(access_token, access_token_secret)
	api = tweepy.API(auth)
	return(api)

# Use the API service object to get the first profile id
def get_ga_profile(service):
	# Get a list of all Google Analytics accounts for this user
	accounts = service.management().accounts().list().execute()

	if accounts.get('items'):
		# Get the first Google Analytics account.
		account = accounts.get('items')[0].get('id')

	# Get a list of all the properties for the first account.
	properties = service.management().webproperties().list(accountId=account).execute()

	if properties.get('items'):
		# Get the first property id.
		property = properties.get('items')[0].get('id')

	# Get a list of all views (profiles) for the first property.
	profiles = service.management().profiles().list(accountId=account, webPropertyId=property).execute()

	if profiles.get('items'):
		# return the first view (profile) id.
		return profiles.get('items')[0].get('id')

	return None

# Executes a subquery using the FB API, appending the results of multiple pages into the main array
def fb_sub_query(orig_data, curr_data):
	r = requests.get(curr_data['paging']['next'])
	r.raise_for_status()
	sub_results = r.json()
	for datum in sub_results['data']:
		orig_data['data'].append(datum)

	if 'paging' in sub_results:
		if 'next' in sub_results['paging']:
			fb_sub_query(orig_data, sub_results)

# Query Facebook Graph API to get page information
def fb_query(fields, token=False):
        if not token:
		token = get_config('FACEBOOK', 'Access_Token')
	
        graph_url = 'https://graph.facebook.com/v' + get_config('FACEBOOK', 'API_Version')
	page_id = 'me' # Access token is for own page
        url = '%s/%s?access_token=%s&fields=%s' % (graph_url, page_id, token, fields)
        
        r = requests.get(url)
	r.raise_for_status()

	results = r.json()

	for prop in results:
		if isinstance(results[prop], dict):
			if 'paging' in results[prop]:
				if 'next' in results[prop]['paging']:
					fb_sub_query(results[prop], results[prop])

	return(results)

# Insights queries require read_insights privilege
def fb_insights_query(metrics, period=False, since=False, until=False, token=False):
	metrics = ','.join(metrics)

	if not token:
		token = get_config('FACEBOOK', 'Access_Token')

	graph_url = 'https://graph.facebook.com/v' + get_config('FACEBOOK', 'API_Version')
	page_id = 'me' # Access token is for own page

	if period:
		if not period in ['day', 'week', 'month', 'days_28', 'lifetime']:
			period = False

	if period:
		url = '%s/%s/insights/%s?access_token=%s&period=%s' % (graph_url, page_id, metrics, token, period)
		if since:
			url += '&since=%s' % since
		if until:
			url += '&until=%s' % until
		r = requests.get(url)
	else:
		r = requests.get('%s/%s/insights/%s?access_token=%s' % (graph_url, page_id, metrics, token))

	r.raise_for_status()
	results = r.json()

	for prop in results:
		if isinstance(results[prop], dict):
			if 'paging' in results[prop]:
				if 'next' in results[prop]['paging']:
					fb_sub_query(results[prop], results[prop])

	return(results)

# Renew Facebook access token
def renew_fb_token():
	url = 'https://graph.facebook.com/v' + get_config('FACEBOOK', 'API_Version')
	url += '/oauth/access_token?grant_type=fb_exchange_token&client_id=%s' % get_config('FACEBOOK', 'App_ID')
	url += '&client_secret=%s&Reset&fb_exchange_token=%s' % (get_config('FACEBOOK', 'App_Secret'), get_config('FACEBOOK', 'Access_Token'))

	r = requests.get(url)
	new_token = r.json()['access_token']
	perm_token = fb_query('access_token', new_token)['access_token']

	write_config('FACEBOOK', 'Access_Token', perm_token)
	logging.info('New Facebook access token written to %s.' % CONFIG)

# Query Google Analytics API to retrieve some data
def ga_query(service, start_date, end_date, metrics, dimensions=None, filters=None):
	def fetch_results(service, start_date, end_date, metrics, dimensions, results=[], start_index=1):
		if dimensions is None:
			if filters is None:
				new_results = service.data().ga().get(
					ids='ga:' + get_config('GOOGLE_ANALYTICS', 'Profile'),
					start_date=start_date,
					end_date=end_date,
					max_results=10000,
					start_index=start_index,
					metrics=metrics).execute()
			else:
				new_results = service.data().ga().get(
					ids='ga:' + get_config('GOOGLE_ANALYTICS', 'Profile'),
					start_date=start_date,
					end_date=end_date,
					max_results=10000,
					start_index=start_index,
					metrics=metrics,
					filters=filters).execute()
		else:
			if filters is None:
				new_results = service.data().ga().get(
					ids='ga:' + get_config('GOOGLE_ANALYTICS', 'Profile'),
					start_date=start_date,
					end_date=end_date,
					metrics=metrics,
					max_results=10000,
					start_index=start_index,
					dimensions=dimensions).execute()
			else:
				new_results = service.data().ga().get(
					ids='ga:' + get_config('GOOGLE_ANALYTICS', 'Profile'),
					start_date=start_date,
					end_date=end_date,
					metrics=metrics,
					max_results=10000,
					start_index=start_index,
					dimensions=dimensions,
					filters=filters).execute()

		if new_results.has_key('rows'):
			results = results + new_results['rows']
			new_start_index = int(new_results['query']['start-index']) + len(new_results['rows'])
			if (new_results['totalResults'] >= new_start_index):
				results = fetch_results(service, start_date, end_date, metrics, dimensions, results, new_start_index)
				return(results)
			else:
				return(results)
		else:
			results = results + []

	results = fetch_results(service, start_date, end_date, metrics, dimensions)
	if (results is None):
		results = []
	return(results)

# Get all youtube videos belonging to the configured YouTube channel
def my_yt_videos():
	youtube = google_api('youtube', 'v3', ['https://www.googleapis.com/auth/youtube'])
	max_results = 50

	def video_search(youtube, next_page, videos=[]):
		if (next_page == False):
			results = youtube.search().list(
				type="video",
				channelId=get_config('GOOGLE_ANALYTICS', 'YouTube_Channel'),
				part="snippet",
				maxResults=max_results
			).execute()
		else:
			results = youtube.search().list(
				type="video",
				channelId=get_config('GOOGLE_ANALYTICS', 'YouTube_Channel'),
				part="snippet",
				pageToken=next_page,
				maxResults=max_results
			).execute()

		video_ids = []
		for item in results['items']:
			video_ids.append(item['id']['videoId'])
		video_ids = ','.join(video_ids)

		video_response = youtube.videos().list(
			id=video_ids,
    		part='snippet, statistics'
		).execute()

		for item in video_response.get('items', []):
			id = item['id']
			title = item['snippet']['title']
			publish_date = item['snippet']['publishedAt']
			channel = item['snippet']['channelTitle']
			views = item['statistics']['viewCount']
			likes = item['statistics']['likeCount']
			dislikes = item['statistics']['dislikeCount']
			video = YT_Video(id, title, publish_date, channel, views, likes, dislikes)
			videos.append(video)

		if (results.has_key('nextPageToken')):
			videos = video_search(youtube, results['nextPageToken'], videos)
			return(videos)
		else:
			return(videos)

	videos = video_search(youtube, False)
	return(videos)

# Get MailChimp subscriber lists
def get_mc_lists(query_string=False):
	user = get_config('MAILCHIMP', 'User')
	api_key = get_config('MAILCHIMP', 'API_Key')
	dc = re.search('-(.*?)$', api_key).group(1)
	if not query_string:
		url = 'https://%s.api.mailchimp.com/3.0/lists' % dc
	else:
		url = 'https://%s.api.mailchimp.com/3.0/lists?%s' % (dc, query_string)

	r = requests.get(url, auth=(user, api_key))
	r.raise_for_status()
	results = r.json()

	lists = []
	for list in results['lists']:
		new_list = MC_List(list['id'], list['name'], list['date_created'], list['subscribe_url_short'], \
			list['stats']['member_count'], list['stats']['unsubscribe_count'], list['stats']['cleaned_count'], \
			list['stats']['campaign_count'], list['stats']['open_rate'], list['stats']['click_rate'], \
			list['stats']['avg_sub_rate'], list['stats']['campaign_last_sent'], list['stats']['last_sub_date'] \
		)
		lists.append(new_list)

	return(lists)

# Get MailChimp campaigns
def get_mc_campaigns():
	user = get_config('MAILCHIMP', 'User')
	api_key = get_config('MAILCHIMP', 'API_Key')
	dc = re.search('-(.*?)$', api_key).group(1)
	url = 'https://%s.api.mailchimp.com/3.0/campaigns' % dc

	r = requests.get(url, auth=(user, api_key))
	r.raise_for_status()
	results = r.json()

	campaigns = []
	for campaign in results['campaigns']:
		new_campaign = MC_Campaign(campaign['id'], campaign['settings']['title'], campaign['settings']['subject_line'], \
			campaign['create_time'], campaign['emails_sent'], campaign['report_summary']['open_rate'], \
			campaign['report_summary']['click_rate'], campaign['report_summary']['subscriber_clicks'], \
			campaign['report_summary']['clicks'], campaign['report_summary']['opens'], \
		 	campaign['report_summary']['unique_opens'])
		campaigns.append(new_campaign)

	return(campaigns)
