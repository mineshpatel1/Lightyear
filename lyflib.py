#! /usr/bin/env python
# LYF data integration function library

import sys, os
import argparse
import httplib2

from ConfigParser import ConfigParser	#	Used for reading the config file
from apiclient.discovery import build	# Builds Google API service
from oauth2client.service_account import ServiceAccountCredentials	# Google authenticator 
from oauth2client import client, file, tools	# Functions for OAuth2

SCRIPT_DIR = os.path.abspath(os.path.dirname(sys.argv[0]))
CONFIG = os.path.join(SCRIPT_DIR, 'config.ini')

# Gets a configuration value from a section and parameter name
def get_config(section, param):
	parser = ConfigParser()
	parser.read(CONFIG)
	out = parser.get(section, param).replace('\\','')
	return out
	
# Gets an authenticated service for a given Google API and versioin
def conn_google(api, version, scopes):
	key_file = os.path.join(SCRIPT_DIR, get_config('GOOGLE_ANALYTICS','Key_File'))
	email = get_config('GOOGLE_ANALYTICS', 'Email')
	credentials = ServiceAccountCredentials.from_p12_keyfile(email, key_file, scopes=scopes)
	http = credentials.authorize(httplib2.Http())
	service = build(api, version, http=http) # Build the service object.

	return service

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

# Query Google Analytics API to retrieve some data
def ga_query(service, start_date, end_date, metrics):
	return service.data().ga().get(
		ids='ga:' + get_config('GOOGLE_ANALYTICS', 'Profile'),
		start_date=start_date,
		end_date=start_date,
		metrics=metrics).execute()
	