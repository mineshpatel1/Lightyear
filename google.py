#!/usr/bin/python

# Extract data from Google Analytics

import lyflib
import argparse
import httplib2

from apiclient.discovery import build
from oauth2client.service_account import ServiceAccountCredentials
from oauth2client import client, file, tools

def print_results(results):
	# Print data nicely for the user.
	if results:
		print 'View (Profile): %s' % results.get('profileInfo').get('profileName')
		print 'Total Sessions: %s' % results.get('rows')[0][0]

	else:
		print 'No results found'

def main():
	# Authenticate and construct service as read only
	service = lyflib.conn_google('analytics', 'v3', ['https://www.googleapis.com/auth/analytics.readonly'])
	print_results(lyflib.ga_query(service, '2016-02-01', '2016-03-01', 'ga:sessions'))


if __name__ == '__main__':
	main()